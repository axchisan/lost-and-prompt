//! Lost & Prompt para Linux y Windows (y macOS en desarrollo): comandos que la interfaz
//! llama sobre el núcleo `lap_core`.

mod launcher;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use lap_core::model::model_name;
use lap_core::{paths, settings, Collection, Message, Organization, SearchIndex, SessionSummary, Tint};
use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

#[derive(Default)]
struct AppState {
    summaries: Mutex<Vec<SessionSummary>>,
    organization: Mutex<Organization>,
    index: Mutex<Option<SearchIndex>>,
    indexing: Arc<AtomicBool>,
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

fn home() -> String {
    dirs::home_dir().map(|h| h.to_string_lossy().into_owned()).unwrap_or_default()
}

fn to_dto(summary: &SessionSummary, org: &Organization, home: &str) -> Option<SessionDto> {
    let cwd = summary.cwd.clone()?;
    let ai_title = summary.display_title().unwrap_or_else(|| "—".into());
    let custom_title = org.custom_titles.get(&summary.id).cloned();
    let is_home = Path::new(&cwd) == Path::new(home);
    let folder_name = Path::new(&cwd).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| cwd.clone());
    let abbreviated_path = match cwd.strip_prefix(home) {
        Some(rest) if !home.is_empty() => format!("~{rest}"),
        _ => cwd.clone(),
    };
    Some(SessionDto {
        id: summary.id,
        title: custom_title.clone().unwrap_or_else(|| ai_title.clone()),
        ai_title,
        custom_title,
        folder_exists: Path::new(&cwd).is_dir(),
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
fn load_library(app: AppHandle, state: State<'_, AppState>) -> Library {
    let scanned = lap_core::scan(&paths::projects_dir(), Some(&data_file("index-cache.json")));
    // Si una sesión se copió a otra carpeta, queda la copia más reciente.
    let mut latest: std::collections::HashMap<Uuid, SessionSummary> = std::collections::HashMap::new();
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
    let home = home();
    let sessions = summaries.iter().filter_map(|s| to_dto(s, &organization, &home)).collect();
    let library = Library {
        sessions,
        collections: organization.collections.clone(),
        retention_days: settings::retention_days(&paths::settings_file()),
        claude_folder_exists: paths::projects_dir().is_dir(),
        platform: std::env::consts::OS,
        home,
    };
    *state.organization.lock().unwrap() = organization;
    *state.summaries.lock().unwrap() = summaries.clone();
    update_index(app, summaries, state.indexing.clone());
    library
}

/// Indexa en segundo plano con su propia conexión (SQLite en modo WAL permite leer a la vez).
fn update_index(app: AppHandle, summaries: Vec<SessionSummary>, indexing: Arc<AtomicBool>) {
    if indexing.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::spawn(move || {
        if let Ok(mut index) = SearchIndex::open(&data_file("search.sqlite")) {
            let _ = index.update(&summaries, |done, total| {
                let _ = app.emit("index-progress", Progress { done, total });
            });
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
    let session = summaries.iter().find(|s| s.id == id).ok_or("No se encontró la sesión")?;
    let cwd = session.cwd.clone().ok_or("La sesión no tiene carpeta")?;
    if !Path::new(&cwd).is_dir() {
        return Err(format!("La carpeta «{cwd}» ya no existe."));
    }
    let title = session.display_title().unwrap_or_default();
    launcher::resume(&terminal, &cwd, &session.resume_command(&extra_arguments), &title, custom_template.as_deref())
}

#[tauri::command]
fn reveal(id: Uuid, state: State<'_, AppState>) -> Result<(), String> {
    let cwd = state.summaries.lock().unwrap().iter().find(|s| s.id == id).and_then(|s| s.cwd.clone());
    let cwd = cwd.ok_or("La sesión no tiene carpeta")?;
    tauri_plugin_opener::open_path(&cwd, None::<&str>).map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Abrir la app otra vez enfoca la ventana que ya está abierta.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            watch_projects(app.handle());
            Ok(())
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
            reveal
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Lost & Prompt");
}
