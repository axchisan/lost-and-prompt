//! Lost & Prompt para Linux y Windows (y macOS en desarrollo): comandos que la interfaz
//! llama sobre el núcleo `lap_core`.

mod launcher;
mod roots;
mod tray;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use lap_core::model::model_name;
use lap_core::{encode_project_dir, paths, settings, Collection, Message, Organization, SearchIndex, SessionSummary, Tint};
use notify::{RecursiveMode, Watcher};
use roots::Root;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
use uuid::Uuid;

#[derive(Default)]
struct AppState {
    summaries: Mutex<Vec<SessionSummary>>,
    roots: Mutex<Vec<Root>>,
    organization: Mutex<Organization>,
    index: Mutex<Option<SearchIndex>>,
    indexing: Arc<AtomicBool>,
    /// Con la bandeja activa, cerrar la ventana la oculta en vez de salir.
    keep_in_tray: AtomicBool,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

fn data_file(name: &str) -> PathBuf {
    paths::app_data_dir().join(name)
}

/// Sesión tal como la muestra la interfaz.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionDto {
    id: Uuid,
    title: String,
    ai_title: String,
    custom_title: Option<String>,
    cwd: String,
    folder_name: String,
    abbreviated_path: String,
    is_home: bool,
    /// Distribución de WSL, si la sesión viene de ahí.
    environment: Option<String>,
    git_branch: Option<String>,
    started_at: DateTime<Utc>,
    last_activity: DateTime<Utc>,
    user_messages: u32,
    total_messages: u32,
    cost_usd: Option<f64>,
    model: String,
    is_favorite: bool,
    collection_ids: Vec<String>,
    first_prompt: String,
    last_reply: Option<String>,
    folder_exists: bool,
    note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Library {
    sessions: Vec<SessionDto>,
    collections: Vec<Collection>,
    retention_days: Option<u32>,
    claude_folder_exists: bool,
    platform: &'static str,
    home: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress {
    done: usize,
    total: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Hit {
    session_id: Uuid,
    snippet: String,
}

fn root_of<'a>(roots: &'a [Root], summary: &SessionSummary) -> Option<&'a Root> {
    roots.iter().find(|r| r.contains(Path::new(&summary.path)))
}

/// Carpeta de la sesión: la elegida por el usuario si la reanudó en otro sitio, o la original.
fn session_cwd(summary: &SessionSummary, org: &Organization) -> Option<String> {
    org.relocations.get(&summary.id).cloned().or_else(|| summary.cwd.clone())
}

fn to_dto(summary: &SessionSummary, org: &Organization, root: &Root) -> Option<SessionDto> {
    let cwd = session_cwd(summary, org)?;
    let ai_title = summary.display_title().unwrap_or_else(|| "—".into());
    let custom_title = org.custom_titles.get(&summary.id).cloned();
    let home = root.home.as_str();
    let is_home = cwd.trim_end_matches(['/', '\\']) == home.trim_end_matches(['/', '\\']);
    let folder_name = cwd.rsplit(['/', '\\']).find(|p| !p.is_empty()).unwrap_or(&cwd).to_owned();
    let abbreviated_path = match cwd.strip_prefix(home) {
        Some(rest) if !home.is_empty() => format!("~{rest}"),
        _ => cwd.clone(),
    };
    Some(SessionDto {
        id: summary.id,
        title: custom_title.clone().unwrap_or_else(|| ai_title.clone()),
        ai_title,
        custom_title,
        folder_exists: root.native_path(&cwd).is_dir(),
        environment: root.distro.clone(),
        cwd,
        folder_name,
        abbreviated_path,
        is_home,
        git_branch: summary.git_branch.clone(),
        started_at: summary.started_at.unwrap_or(summary.modified),
        last_activity: summary.modified,
        user_messages: summary.user_messages,
        total_messages: summary.user_messages + summary.assistant_messages,
        cost_usd: summary.cost_usd,
        model: model_name(summary.model.as_deref()),
        is_favorite: org.favorites.contains(&summary.id),
        collection_ids: org.collections_of(summary.id).into_iter().map(str::to_owned).collect(),
        first_prompt: summary.first_prompt.clone().unwrap_or_default(),
        last_reply: summary.last_reply.clone(),
        note: org.notes.get(&summary.id).cloned(),
    })
}

// MARK: Comandos

#[tauri::command]
fn load_library(include_wsl: Option<bool>, app: AppHandle, state: State<'_, AppState>) -> Library {
    let roots = roots::roots(include_wsl.unwrap_or(true));
    let dirs: Vec<PathBuf> = roots.iter().map(|r| r.dir.clone()).collect();
    let scanned = lap_core::scan_many(&dirs, Some(&data_file("index-cache.json")));
    // Si una sesión se copió a otra carpeta, queda la copia más reciente.
    let mut latest: HashMap<Uuid, SessionSummary> = HashMap::new();
    for summary in scanned {
        match latest.get(&summary.id) {
            Some(existing) if existing.modified >= summary.modified => {}
            _ => {
                latest.insert(summary.id, summary);
            }
        }
    }
    let summaries: Vec<SessionSummary> = latest.into_values().collect();
    let organization = Organization::load(&data_file("organization.json"));
    let sessions = summaries
        .iter()
        .filter_map(|s| root_of(&roots, s).and_then(|root| to_dto(s, &organization, root)))
        .collect();
    let library = Library {
        sessions,
        collections: organization.collections.clone(),
        retention_days: settings::retention_days(&paths::settings_file()),
        claude_folder_exists: paths::projects_dir().is_dir(),
        platform: std::env::consts::OS,
        home: roots[0].home.clone(),
    };
    *state.organization.lock().unwrap() = organization;
    *state.summaries.lock().unwrap() = summaries.clone();
    *state.roots.lock().unwrap() = roots;
    update_index(app, summaries, state.indexing.clone());
    library
}

/// Indexa en segundo plano con su propia conexión (SQLite en modo WAL permite leer a la vez).
fn update_index(app: AppHandle, summaries: Vec<SessionSummary>, indexing: Arc<AtomicBool>) {
    if indexing.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::spawn(move || {
        match SearchIndex::open(&data_file("search.sqlite")) {
            Ok(mut index) => {
                if let Err(error) = index.update(&summaries, |done, total| {
                    let _ = app.emit("index-progress", Progress { done, total });
                }) {
                    log::warn!("no se pudo indexar: {error}");
                }
            }
            Err(error) => log::warn!("no se pudo abrir el índice: {error}"),
        }
        indexing.store(false, Ordering::SeqCst);
        let _ = app.emit("index-finished", ());
    });
}

#[tauri::command]
fn get_messages(id: Uuid, state: State<'_, AppState>) -> Vec<Message> {
    let path = state.summaries.lock().unwrap().iter().find(|s| s.id == id).map(|s| s.path.clone());
    path.map(|p| lap_core::messages(Path::new(&p))).unwrap_or_default()
}

#[tauri::command]
fn search(query: String, limit: Option<usize>, state: State<'_, AppState>) -> Vec<Hit> {
    let mut guard = state.index.lock().unwrap();
    if guard.is_none() {
        *guard = SearchIndex::open(&data_file("search.sqlite")).ok();
    }
    let Some(index) = guard.as_ref() else { return vec![] };
    index
        .search(&query, limit.unwrap_or(60))
        .unwrap_or_default()
        .into_iter()
        .map(|h| Hit { session_id: h.session_id, snippet: h.snippet })
        .collect()
}

fn with_organization<T>(state: &State<'_, AppState>, change: impl FnOnce(&mut Organization) -> T) -> Result<T, String> {
    let mut org = state.organization.lock().unwrap();
    let result = change(&mut org);
    org.save(&data_file("organization.json")).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn toggle_favorite(id: Uuid, state: State<'_, AppState>) -> Result<bool, String> {
    with_organization(&state, |org| org.toggle_favorite(id))
}

#[tauri::command]
fn rename_session(id: Uuid, title: String, original: String, state: State<'_, AppState>) -> Result<(), String> {
    with_organization(&state, |org| org.rename(id, &title, &original))
}

#[tauri::command]
fn set_note(id: Uuid, text: String, state: State<'_, AppState>) -> Result<(), String> {
    with_organization(&state, |org| org.set_note(id, &text))
}

#[tauri::command]
fn create_collection(name: String, tint: Tint, state: State<'_, AppState>) -> Result<Collection, String> {
    with_organization(&state, |org| org.create_collection(&name, tint))
}

#[tauri::command]
fn delete_collection(id: String, state: State<'_, AppState>) -> Result<(), String> {
    with_organization(&state, |org| org.delete_collection(&id))
}

#[tauri::command]
fn toggle_membership(id: Uuid, collection: String, state: State<'_, AppState>) -> Result<bool, String> {
    with_organization(&state, |org| org.toggle_membership(id, &collection))
}

#[tauri::command]
fn set_retention(days: u32) -> Result<Option<u32>, String> {
    let file = paths::settings_file();
    settings::set_retention_days(&file, days).map_err(|e| e.to_string())?;
    Ok(settings::retention_days(&file))
}

#[tauri::command]
fn terminals() -> Vec<launcher::TerminalInfo> {
    launcher::available()
}

#[tauri::command]
fn resume(
    id: Uuid,
    terminal: String,
    extra_arguments: String,
    custom_template: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let summaries = state.summaries.lock().unwrap();
    let roots = state.roots.lock().unwrap();
    let org = state.organization.lock().unwrap();
    let session = summaries.iter().find(|s| s.id == id).ok_or("No se encontró la sesión")?;
    let root = root_of(&roots, session).ok_or("No se encontró la carpeta de la sesión")?;
    let cwd = session_cwd(session, &org).ok_or("La sesión no tiene carpeta")?;
    if !root.native_path(&cwd).is_dir() {
        return Err(format!("La carpeta «{cwd}» ya no existe."));
    }
    let command = session.resume_command(&extra_arguments);
    log::info!("reanudar {id} en {terminal}");
    let result = match &root.distro {
        Some(distro) => launcher::resume_wsl(distro, &cwd, &command),
        None => launcher::resume(&terminal, &cwd, &command, &session.display_title().unwrap_or_default(), custom_template.as_deref()),
    };
    if let Err(error) = &result {
        log::warn!("no se pudo reanudar {id}: {error}");
    }
    result
}

/// Reanudar una sesión cuya carpeta ya no existe: Claude Code busca la sesión en la carpeta de
/// proyecto que corresponde al directorio, así que se copia allí el archivo.
#[tauri::command]
fn relocate(id: Uuid, new_cwd: String, state: State<'_, AppState>) -> Result<(), String> {
    let summaries = state.summaries.lock().unwrap();
    let roots = state.roots.lock().unwrap();
    let session = summaries.iter().find(|s| s.id == id).ok_or("No se encontró la sesión")?;
    let root = root_of(&roots, session).ok_or("No se encontró la carpeta de la sesión")?;
    if root.distro.is_some() {
        return Err("Mover sesiones de WSL todavía no está disponible.".into());
    }
    let source = Path::new(&session.path);
    let destination = root.dir.join(encode_project_dir(&new_cwd));
    std::fs::create_dir_all(&destination).map_err(|e| e.to_string())?;
    let target = destination.join(source.file_name().ok_or("archivo no válido")?);
    if !target.exists() {
        std::fs::copy(source, &target).map_err(|e| e.to_string())?;
    }
    drop((summaries, roots));
    with_organization(&state, |org| {
        org.relocations.insert(id, new_cwd);
    })
}

#[tauri::command]
fn reveal(id: Uuid, state: State<'_, AppState>) -> Result<(), String> {
    let summaries = state.summaries.lock().unwrap();
    let roots = state.roots.lock().unwrap();
    let org = state.organization.lock().unwrap();
    let session = summaries.iter().find(|s| s.id == id).ok_or("No se encontró la sesión")?;
    let root = root_of(&roots, session).ok_or("No se encontró la carpeta de la sesión")?;
    let cwd = session_cwd(session, &org).ok_or("La sesión no tiene carpeta")?;
    tauri_plugin_opener::open_path(root.native_path(&cwd), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_tray(content: tray::TrayContent, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.keep_in_tray.store(content.enabled, Ordering::SeqCst);
    tray::update(&app, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn autostart_enabled(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(enabled: bool, app: AppHandle) -> Result<(), String> {
    let launcher = app.autolaunch();
    if enabled { launcher.enable() } else { launcher.disable() }.map_err(|e| e.to_string())
}

/// Cómo se instaló la app: decide si el actualizador puede instalar versiones nuevas solo.
#[tauri::command]
fn install_kind() -> &'static str {
    if cfg!(target_os = "windows") {
        "nsis"
    } else if cfg!(target_os = "macos") {
        "dev"
    } else if std::env::var_os("APPIMAGE").is_some() {
        "appimage"
    } else {
        "package"
    }
}

#[tauri::command]
fn open_logs(app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    tauri_plugin_opener::open_path(dir, None::<&str>).map_err(|e| e.to_string())
}

/// Avisa a la interfaz (agrupando cambios seguidos) cuando cambia `~/.claude/projects`.
fn watch_projects(app: &AppHandle) {
    let pending = Arc::new(AtomicBool::new(false));
    let handle = app.clone();
    let watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if event.is_err() || pending.swap(true, Ordering::SeqCst) {
            return;
        }
        let pending = pending.clone();
        let handle = handle.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(1500));
            pending.store(false, Ordering::SeqCst);
            let _ = handle.emit("sessions-changed", ());
        });
    });
    if let Ok(mut watcher) = watcher {
        if watcher.watch(&paths::projects_dir(), RecursiveMode::Recursive).is_ok() {
            *app.state::<AppState>().watcher.lock().unwrap() = Some(watcher);
        }
    }
}

/// Atajo global para el buscador desde cualquier app. Si otro programa ya lo usa, se omite.
fn register_shortcut(app: &AppHandle) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                tray::show_main(app);
                let _ = app.emit("quick-open", ());
            }
        })
        .build();
    if app.plugin(plugin).is_ok() {
        if let Err(error) = app.global_shortcut().register("CommandOrControl+Alt+K") {
            log::warn!("no se pudo registrar el atajo global: {error}");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

    tauri::Builder::default()
        // Abrir la app otra vez enfoca la ventana que ya está abierta.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main(app)))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([Target::new(TargetKind::Stdout), Target::new(TargetKind::LogDir { file_name: Some("lost-and-prompt".into()) })])
                .level(log::LevelFilter::Info)
                .max_file_size(1_000_000)
                .rotation_strategy(RotationStrategy::KeepOne)
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle();
            watch_projects(handle);
            register_shortcut(handle);
            if let Err(error) = tray::create(handle) {
                log::warn!("no se pudo crear el ícono de la bandeja: {error}");
            }
            // Al abrirse con el inicio de sesión, queda en la bandeja sin mostrar la ventana.
            if std::env::args().any(|a| a == "--hidden") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            log::info!("Lost & Prompt {} en {}", app.package_info().version, std::env::consts::OS);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<AppState>().keep_in_tray.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_library,
            get_messages,
            search,
            toggle_favorite,
            rename_session,
            set_note,
            create_collection,
            delete_collection,
            toggle_membership,
            set_retention,
            terminals,
            resume,
            relocate,
            reveal,
            update_tray,
            autostart_enabled,
            set_autostart,
            install_kind,
            open_logs
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Lost & Prompt");
}
