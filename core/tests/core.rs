//! Pruebas del núcleo con una sesión ficticia que reúne los casos difíciles del formato.

use std::path::{Path, PathBuf};

use lap_core::model::model_name;
use lap_core::{encode_project_dir, messages, scan, settings, Organization, Role, SearchIndex, Tint};

const ID: &str = "3f1c2a9e-7b4d-4e21-9a6f-0c8d5e2b1a77";

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn fixture_file() -> PathBuf {
    fixtures().join("-Users-ana-Developer-acme").join(format!("{ID}.jsonl"))
}

#[test]
fn resume_la_sesion() {
    let sessions = scan(&fixtures(), None);
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!(s.id.to_string(), ID);
    assert_eq!(s.ai_title.as_deref(), Some("Migración del checkout a Stripe"));
    // El cwd cambia a /web durante la sesión, pero vale el que corresponde a la carpeta.
    assert_eq!(s.cwd.as_deref(), Some("/Users/ana/Developer/acme"));
    assert_eq!(s.git_branch.as_deref(), Some("main"));
    // Ni el recordatorio del sistema, ni el resultado de herramienta, ni el mensaje interno,
    // ni la interrupción cuentan como mensajes tuyos.
    assert_eq!(s.user_messages, 2);
    assert_eq!(s.assistant_messages, 3);
    assert_eq!(s.cost_usd, Some(3.5));
    assert_eq!(s.model.as_deref(), Some("claude-opus-5-5"));
    assert_eq!(model_name(s.model.as_deref()), "Opus 5.5");
    assert_eq!(s.first_prompt.as_deref(), Some("Migra el checkout de PayPal a Stripe sin romper los pedidos guardados."));
    assert_eq!(s.last_reply.as_deref(), Some("Listo: el checkout ya usa Stripe con webhooks."));
    assert_eq!(s.started_at.unwrap().to_rfc3339(), "2026-10-30T18:02:00+00:00");
    assert_eq!(s.resume_command("--model opus"), format!("claude --resume {ID} --model opus"));
}

#[test]
fn lee_la_conversacion_sin_ruido() {
    let list = messages(&fixture_file());
    let summary: Vec<(Role, &str, u32)> = list.iter().map(|m| (m.role, m.text.as_str(), m.tool_count)).collect();
    assert_eq!(
        summary,
        vec![
            (Role::User, "Migra el checkout de PayPal a Stripe sin romper los pedidos guardados.", 0),
            (Role::Assistant, "Reviso primero cómo se crean los pedidos.", 2),
            (Role::User, "Dale, hazlo con webhooks.", 0),
            (Role::Assistant, "Listo: el checkout ya usa Stripe con webhooks.", 0),
        ]
    );
}

#[test]
fn codifica_carpetas_como_claude_code() {
    assert_eq!(encode_project_dir("/Users/ana/Developer/acme"), "-Users-ana-Developer-acme");
    assert_eq!(encode_project_dir("/Users/ana/My Web/site.com"), "-Users-ana-My-Web-site-com");
    assert_eq!(encode_project_dir(r"C:\Users\ana\código"), "C--Users-ana-c-digo");
}

#[test]
fn escanea_varias_carpetas_sin_duplicar() {
    let dir = tempfile::tempdir().unwrap();
    let copy = dir.path().join("-Users-ana-Developer-acme");
    std::fs::create_dir_all(&copy).unwrap();
    std::fs::copy(fixture_file(), copy.join(format!("{ID}.jsonl"))).unwrap();
    let sessions = lap_core::scan_many(&[fixtures(), dir.path().to_path_buf()], None);
    assert_eq!(sessions.len(), 2, "una por carpeta; la app decide cuál mostrar");
    assert!(sessions.iter().all(|s| s.id.to_string() == ID));
}

#[test]
fn reutiliza_la_cache() {
    let dir = tempfile::tempdir().unwrap();
    let cache = dir.path().join("index-cache.json");
    let first = scan(&fixtures(), Some(&cache));
    assert!(cache.exists());
    let second = scan(&fixtures(), Some(&cache));
    assert_eq!(first, second);
}

#[test]
fn busca_en_las_conversaciones() {
    let dir = tempfile::tempdir().unwrap();
    let sessions = scan(&fixtures(), None);
    let mut index = SearchIndex::open(&dir.path().join("search.sqlite")).unwrap();
    let mut calls = vec![];
    assert_eq!(index.update(&sessions, |done, total| calls.push((done, total))).unwrap(), 1);
    assert_eq!(calls.last(), Some(&(1, 1)));
    // Sin cambios no vuelve a indexar.
    assert_eq!(index.update(&sessions, |_, _| {}).unwrap(), 0);

    let hits = index.search("webhook", 10).unwrap();
    assert_eq!(hits.len(), 1, "una coincidencia por sesión");
    assert!(hits[0].snippet.contains("\u{1}webhooks\u{2}"), "{:?}", hits[0].snippet);
    // Ignora tildes y mayúsculas.
    assert_eq!(index.search("COMO SE CREAN", 10).unwrap().len(), 1);
    // Los resultados de herramientas no se indexan.
    assert!(index.search("orders.ts", 10).unwrap().is_empty());
    // Comillas del usuario no rompen la consulta.
    assert!(index.search("\"", 10).unwrap().is_empty());

    // Si la sesión desaparece, sale del índice.
    index.update(&[], |_, _| {}).unwrap();
    assert!(index.search("webhook", 10).unwrap().is_empty());
}

#[test]
fn guarda_la_organizacion() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("organization.json");
    let id = uuid::Uuid::parse_str(ID).unwrap();
    let mut org = Organization::default();
    assert!(org.toggle_favorite(id));
    org.rename(id, "  Stripe  ", "Migración del checkout a Stripe");
    org.set_note(id, "Faltan los reembolsos");
    let collection = org.create_collection("Cliente Acme", Tint::Indigo);
    assert!(org.toggle_membership(id, &collection.id));
    org.save(&path).unwrap();

    let loaded = Organization::load(&path);
    assert_eq!(loaded, org);
    assert_eq!(loaded.custom_titles[&id], "Stripe");
    assert_eq!(loaded.collections_of(id), vec![collection.id.as_str()]);

    let mut org = loaded;
    org.rename(id, "Migración del checkout a Stripe", "Migración del checkout a Stripe");
    assert!(org.custom_titles.is_empty(), "volver al título original quita el nombre propio");
    org.delete_collection(&collection.id);
    assert!(org.collections_of(id).is_empty());
}

#[test]
fn ajusta_la_retencion_con_copia() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("settings.json");
    std::fs::write(&file, r#"{"model":"opus","theme":"dark"}"#).unwrap();
    assert_eq!(settings::retention_days(&file), None);

    let backup = settings::set_retention_days(&file, 180).unwrap().expect("copia");
    assert_eq!(std::fs::read_to_string(&backup).unwrap(), r#"{"model":"opus","theme":"dark"}"#);
    assert_eq!(settings::retention_days(&file), Some(180));
    let text = std::fs::read_to_string(&file).unwrap();
    assert!(text.find("model").unwrap() < text.find("theme").unwrap(), "conserva el orden: {text}");

    // Un archivo que no es un objeto JSON no se toca.
    std::fs::write(&file, "[1, 2]").unwrap();
    assert!(settings::set_retention_days(&file, 30).is_err());
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "[1, 2]");
}

#[test]
fn archiva_y_lee_organizaciones_antiguas() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("organization.json");
    let id = uuid::Uuid::parse_str(ID).unwrap();
    // Archivo de una versión anterior, sin el campo `archived`: no debe perder los favoritos.
    std::fs::write(&path, format!(r#"{{"favorites":["{ID}"],"collections":[]}}"#)).unwrap();
    let mut org = Organization::load(&path);
    assert!(org.favorites.contains(&id));
    assert!(org.archived.is_empty());

    assert!(org.toggle_archive(id));
    org.save(&path).unwrap();
    assert!(Organization::load(&path).archived.contains(&id));
    assert!(!org.toggle_archive(id), "la segunda vez la recupera");
}

#[test]
fn lee_el_razonamiento_con_texto() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("razonamiento.jsonl");
    let lines = [
        r#"{"type":"user","timestamp":"2026-10-29T14:02:00Z","message":{"role":"user","content":"¿Qué motor usa?"}}"#,
        r#"{"type":"assistant","timestamp":"2026-10-29T14:03:00Z","message":{"content":[{"type":"thinking","thinking":"","signature":"abc"},{"type":"thinking","thinking":"Trae UnityPlayer.dll: es Unity."},{"type":"text","text":"Es Unity."},{"type":"tool_use","name":"Bash"}]}}"#,
    ];
    std::fs::write(&file, lines.join("\n")).unwrap();
    let list = messages(&file);
    let roles: Vec<(bool, &str)> = list.iter().map(|m| (m.thinking, m.text.as_str())).collect();
    assert_eq!(roles, vec![(false, "¿Qué motor usa?"), (true, "Trae UnityPlayer.dll: es Unity."), (false, "Es Unity.")]);
    assert_eq!(list[2].tool_count, 1, "la herramienta cuenta en la respuesta, no en el razonamiento");
}

#[test]
fn colecciones_con_carpetas() {
    let id = uuid::Uuid::parse_str(ID).unwrap();
    let mut org = Organization::default();
    let collection = org.create_collection("Cliente Acme", Tint::Indigo);
    assert!(org.toggle_folder(&collection.id, "/Users/ana/Developer/acme"));
    assert_eq!(org.folder_collections_of("/Users/ana/Developer/acme"), vec![collection.id.as_str()]);
    assert_eq!(org.folder_collections_of("/Users/ana/Developer/acme/api"), vec![collection.id.as_str()], "las subcarpetas entran");
    assert!(org.folder_collections_of("/Users/ana/Developer/acme-store").is_empty(), "un nombre que empieza igual no entra");
    assert!(org.toggle_folder(&collection.id, r"C:\Users\ana\proyectos"));
    assert_eq!(org.folder_collections_of(r"C:\Users\ana\proyectos\web").len(), 1, "rutas de Windows");

    org.update_collection(&collection.id, "  Acme  ", Tint::Green);
    assert_eq!((org.collections[0].name.as_str(), org.collections[0].tint), ("Acme", Tint::Green));
    assert!(org.collections_of(id).is_empty(), "la pertenencia por carpeta no toca las sesiones añadidas a mano");

    assert!(!org.toggle_folder(&collection.id, "/Users/ana/Developer/acme"));
    org.delete_collection(&collection.id);
    assert!(org.collection_folders.is_empty());
}

#[test]
fn importa_una_sesion_compartida() {
    let dir = tempfile::tempdir().unwrap();
    let projects = dir.path().join("projects");
    let id = uuid::Uuid::parse_str(ID).unwrap();

    let shared = lap_core::share::inspect(&fixture_file()).unwrap();
    assert_eq!(shared.manifest.session_id, id);
    assert!(!shared.packaged, "un .jsonl suelto, como exportaban las versiones anteriores");
    assert!(shared.manifest.cwd.is_some(), "trae la carpeta original");

    let (imported, target) = lap_core::share::import(&projects, &fixture_file(), "/Users/luis/proyectos/acme").unwrap();
    assert_eq!(imported.manifest.session_id, id);
    assert_eq!(target, projects.join("-Users-luis-proyectos-acme").join(format!("{ID}.jsonl")));
    assert_eq!(scan(&projects, None).len(), 1, "Claude Code (y la app) la encuentran ahí");
    assert!(lap_core::share::import(&projects, &fixture_file(), "/Users/luis/proyectos/acme").is_err(), "no sobrescribe");

    let other = dir.path().join("notas.jsonl");
    std::fs::write(&other, "{\"hola\": 1}\n").unwrap();
    assert!(lap_core::share::inspect(&other).is_err(), "un JSONL cualquiera no es una sesión");
}

/// Una sesión con subagente, una salida guardada en `tool-results` y una clave de GitHub, tal como
/// la deja Claude Code en el equipo de origen.
fn session_with_extras(root: &Path) -> PathBuf {
    let folder = root.join("projects").join("C--Users-braya-figuras");
    let session = folder.join(format!("{ID}.jsonl"));
    let saved = folder.join(ID).join("tool-results").join("abc.txt");
    std::fs::create_dir_all(saved.parent().unwrap()).unwrap();
    std::fs::create_dir_all(folder.join(ID).join("subagents")).unwrap();
    std::fs::write(&saved, "salida larga").unwrap();
    std::fs::write(folder.join(ID).join("subagents").join("agent-1.jsonl"), format!("{{\"sessionId\":\"{ID}\",\"isSidechain\":true}}\n")).unwrap();
    let saved_text = saved.to_string_lossy();
    let lines = [
        serde_json::json!({"type": "user", "sessionId": ID, "cwd": "C:\\Users\\braya\\figuras", "message": {"role": "user", "content": "lee el .env"}}),
        serde_json::json!({"type": "assistant", "sessionId": ID, "message": {"role": "assistant", "content": [{"type": "tool_use", "id": "t1", "name": "Read", "input": {}}]}}),
        serde_json::json!({"type": "user", "sessionId": ID, "toolUseResult": {"stdout": "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789"},
            "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t1", "content": format!("GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\nOutput saved to: {saved_text}")}]}}),
        serde_json::json!({"type": "api-request-blob", "sessionId": ID, "message": "copia de la petición"}),
        serde_json::json!({"type": "ai-title", "sessionId": ID, "aiTitle": "Figuras 3D"}),
    ];
    std::fs::write(&session, lines.iter().map(|l| l.to_string() + "\n").collect::<String>()).unwrap();
    session
}

fn manifest_for(_session: &Path) -> lap_core::share::Manifest {
    lap_core::share::Manifest {
        session_id: uuid::Uuid::parse_str(ID).unwrap(),
        title: Some("Mis figuras".into()),
        note: Some("Para Brayan".into()),
        cwd: Some(r"C:\Users\braya\figuras".into()),
        app: "Lost & Prompt prueba".into(),
        messages: 1,
        ..lap_core::share::Manifest::default()
    }
}

#[test]
fn exporta_e_importa_un_paquete_lap() {
    use lap_core::share::{self, ExportOptions};
    let origin = tempfile::tempdir().unwrap();
    let session = session_with_extras(origin.path());

    let found = share::scan_secrets(&session, true);
    assert_eq!(found.get("github"), Some(&2), "en la salida y en toolUseResult");
    assert!(share::scan_secrets(&session, false).is_empty(), "sin las salidas no queda ninguna");

    let package = origin.path().join("figuras.lap");
    let manifest = share::export(&session, &package, manifest_for(&session), "# Figuras", ExportOptions::default()).unwrap();
    assert_eq!(manifest.redacted, 2);
    assert!(manifest.tool_output);
    assert!(manifest.source_dir.is_some(), "tiene archivos al lado");

    let shared = share::inspect(&package).unwrap();
    assert!(shared.packaged);
    assert_eq!(shared.manifest.title.as_deref(), Some("Mis figuras"));
    assert_eq!(shared.manifest.note.as_deref(), Some("Para Brayan"));

    let here = tempfile::tempdir().unwrap();
    let projects = here.path().join("projects");
    let (_, target) = share::import(&projects, &package, "/Users/luis/figuras").unwrap();
    let text = std::fs::read_to_string(&target).unwrap();
    assert!(!text.contains("ghp_abc"), "la clave va tapada");
    assert!(text.contains(share::REDACTED));
    let new_saved = target.with_extension("").join("tool-results").join("abc.txt");
    assert!(new_saved.is_file(), "las salidas guardadas viajan");
    assert!(target.with_extension("").join("subagents").join("agent-1.jsonl").is_file(), "y los subagentes");
    let escaped = serde_json::to_string(&new_saved.to_string_lossy()).unwrap();
    assert!(text.contains(escaped.trim_matches('"')), "la referencia apunta al sitio nuevo");
    assert_eq!(scan(&projects, None).len(), 1);
    assert!(share::import(&projects, &package, "/Users/luis/figuras").is_err(), "no sobrescribe");
}

#[test]
fn exporta_sin_las_salidas_de_las_herramientas() {
    use lap_core::share::{self, ExportOptions};
    let origin = tempfile::tempdir().unwrap();
    let session = session_with_extras(origin.path());
    let package = origin.path().join("figuras.lap");
    let options = ExportOptions { tool_output: false, redact: false };
    let manifest = share::export(&session, &package, manifest_for(&session), "", options).unwrap();
    assert!(!manifest.tool_output);
    assert_eq!(manifest.redacted, 0);

    let here = tempfile::tempdir().unwrap();
    let (_, target) = share::import(&here.path().join("projects"), &package, "/Users/luis/figuras").unwrap();
    let text = std::fs::read_to_string(&target).unwrap();
    assert!(!text.contains("ghp_"), "sin la salida no va la clave");
    assert!(!text.contains("api-request-blob"), "ni las copias de las peticiones");
    assert!(text.contains(share::OMITTED));
    assert!(text.contains("\"tool_use_id\":\"t1\""), "el resultado sigue emparejado con su llamada");
    assert!(!target.with_extension("").join("tool-results").exists());
    assert!(target.with_extension("").join("subagents").join("agent-1.jsonl").is_file());
}

#[test]
fn rechaza_paquetes_con_rutas_tramposas() {
    use std::io::Write;
    let dir = tempfile::tempdir().unwrap();
    let package = dir.path().join("malo.lap");
    let mut zip = zip::ZipWriter::new(std::fs::File::create(&package).unwrap());
    let options = zip::write::SimpleFileOptions::default();
    let manifest = format!("{{\"format\":1,\"sessionId\":\"{ID}\"}}");
    for (name, data) in [("manifest.json", manifest.as_str()), ("session.jsonl", "{}\n"), ("files/../../../fuera.txt", "x"), ("files//abs.txt", "x")] {
        zip.start_file(name, options).unwrap();
        zip.write_all(data.as_bytes()).unwrap();
    }
    zip.finish().unwrap();
    let projects = dir.path().join("projects");
    lap_core::share::import(&projects, &package, "/tmp/x").unwrap();
    assert!(!dir.path().join("fuera.txt").exists() && !Path::new("/fuera.txt").exists(), "lo de fuera se ignora");
}

#[test]
fn propone_la_carpeta_donde_importar() {
    use lap_core::share::{normalize_remote, suggest_folder, Manifest};
    assert_eq!(normalize_remote("git@github.com:Axchisan/Figuras.git"), normalize_remote("https://tok@github.com/axchisan/figuras/"));
    let dir = tempfile::tempdir().unwrap();
    let repo = dir.path().join("otro-nombre");
    std::fs::create_dir_all(repo.join(".git")).unwrap();
    std::fs::write(repo.join(".git/config"), "[core]\n\tbare = false\n[remote \"origin\"]\n\turl = git@github.com:braya/figuras.git\n").unwrap();
    let same_name = dir.path().join("figuras");
    std::fs::create_dir_all(&same_name).unwrap();
    let known = vec![same_name.to_string_lossy().into_owned(), repo.to_string_lossy().into_owned()];

    let mut manifest = Manifest { cwd: Some(r"C:\Users\braya\figuras".into()), ..Manifest::default() };
    assert_eq!(suggest_folder(&manifest, &known), Some(known[0].clone()), "mismo nombre");
    manifest.git_remote = Some("https://github.com/braya/figuras".into());
    assert_eq!(suggest_folder(&manifest, &known), Some(known[1].clone()), "el mismo repositorio pesa más");
    manifest.cwd = Some(same_name.to_string_lossy().into_owned());
    assert_eq!(suggest_folder(&manifest, &known), Some(known[0].clone()), "la original, si existe aquí");
}
