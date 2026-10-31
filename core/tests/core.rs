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
