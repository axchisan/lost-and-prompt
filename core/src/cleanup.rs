//! Eliminar sesiones de Claude Code «a nivel Claude»: la conversación y todo lo que Claude Code
//! guarda de ella en su carpeta de configuración.
//!
//! Reglas de seguridad (ver `docs/decisiones.md`):
//! - primero un plan con lo que se va a quitar y cuánto ocupa, que la interfaz enseña antes;
//! - nunca una sesión abierta ahora mismo (`sessions/<pid>.json` con el proceso vivo);
//! - a la papelera del sistema por defecto; el borrado definitivo es una opción explícita;
//! - `history.jsonl` se reescribe sin las líneas de esas sesiones, de forma atómica y con una copia
//!   previa en la carpeta de copias de Lost & Prompt.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{Error, Result};

/// Qué es cada cosa que se va a quitar (para explicarlo en el diálogo).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ItemKind {
    /// `projects/<carpeta>/<id>.jsonl`
    Conversation,
    /// `projects/<carpeta>/<id>/` (subagentes y resultados de herramientas)
    Subagents,
    /// `file-history/<id>/` (copias de los archivos editados, para rebobinar)
    FileHistory,
    /// `session-env/<id>/`
    Environment,
    /// `tasks/session-<prefijo>/`
    Tasks,
    /// `todos/<id>-*.json` (versiones antiguas)
    Todos,
    /// `debug/<id>.txt`
    Debug,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub session: Uuid,
    pub kind: ItemKind,
    pub path: PathBuf,
    pub bytes: u64,
}

/// Sesión que se quiere borrar: su id y su archivo `.jsonl` (de él sale la carpeta de configuración).
#[derive(Debug, Clone)]
pub struct Target {
    pub id: Uuid,
    pub file: PathBuf,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub items: Vec<PlanItem>,
    /// Líneas de `history.jsonl` (lo escrito, para la flecha ↑) por carpeta de configuración.
    pub history: Vec<HistoryEdit>,
    /// Sesiones abiertas ahora mismo en Claude Code: no se pueden borrar.
    pub in_use: Vec<Uuid>,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEdit {
    pub file: PathBuf,
    pub lines: usize,
    pub sessions: Vec<Uuid>,
}

impl Plan {
    pub fn history_lines(&self) -> usize {
        self.history.iter().map(|h| h.lines).sum()
    }
}

/// Carpeta de configuración de un archivo de sesión: `<config>/projects/<carpeta>/<id>.jsonl`.
pub fn config_dir_of(file: &Path) -> Option<PathBuf> {
    let projects = file.parent()?.parent()?;
    (projects.file_name()? == "projects").then(|| projects.parent().map(Path::to_path_buf))?
}

/// Calcula qué se quitaría al borrar estas sesiones, sin tocar nada.
pub fn plan_delete(targets: &[Target]) -> Plan {
    let mut plan = Plan::default();
    let mut by_config: HashMap<PathBuf, Vec<&Target>> = HashMap::new();
    for target in targets {
        if let Some(config) = config_dir_of(&target.file) {
            by_config.entry(config).or_default().push(target);
        }
    }
    for (config, list) in by_config {
        let open = open_sessions(&config);
        let ids: HashSet<Uuid> = list.iter().map(|t| t.id).collect();
        // Prefijos de las sesiones que quedan: su carpeta de tareas no se toca.
        let remaining_prefixes: HashSet<String> = all_session_ids(&config)
            .into_iter()
            .filter(|id| !ids.contains(id))
            .map(prefix)
            .collect();
        for target in list {
            if open.contains(&target.id) {
                plan.in_use.push(target.id);
                continue;
            }
            let id = target.id.to_string();
            let mut add = |kind: ItemKind, path: PathBuf| {
                if path.exists() {
                    let bytes = size_of(&path);
                    plan.items.push(PlanItem { session: target.id, kind, path, bytes });
                }
            };
            add(ItemKind::Conversation, target.file.clone());
            add(ItemKind::Subagents, target.file.with_extension(""));
            add(ItemKind::FileHistory, config.join("file-history").join(&id));
            add(ItemKind::Environment, config.join("session-env").join(&id));
            let short = prefix(target.id);
            if !remaining_prefixes.contains(&short) {
                add(ItemKind::Tasks, config.join("tasks").join(format!("session-{short}")));
            }
            if let Ok(entries) = std::fs::read_dir(config.join("todos")) {
                for entry in entries.flatten() {
                    if entry.file_name().to_string_lossy().starts_with(&format!("{id}-")) {
                        add(ItemKind::Todos, entry.path());
                    }
                }
            }
            add(ItemKind::Debug, config.join("debug").join(format!("{id}.txt")));
        }
        let wanted: HashSet<Uuid> = ids.iter().filter(|id| !plan.in_use.contains(id)).copied().collect();
        let history = config.join("history.jsonl");
        let (lines, sessions) = count_history(&history, &wanted);
        if lines > 0 {
            plan.history.push(HistoryEdit { file: history, lines, sessions });
        }
    }
    plan.total_bytes = plan.items.iter().map(|i| i.bytes).sum();
    plan
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    /// Sesiones borradas (todo su contenido salió bien).
    pub deleted: Vec<Uuid>,
    /// Copias de `history.jsonl` hechas antes de reescribirlo.
    pub backups: Vec<PathBuf>,
    /// Lo que no se pudo quitar, con el motivo.
    pub failures: Vec<String>,
}

/// Ejecuta un plan. `permanent`: borrar del todo en lugar de mandar a la papelera.
/// `backups_dir`: dónde guardar la copia de `history.jsonl`.
///
/// Antes de tocar nada se vuelve a comprobar que ninguna sesión se haya abierto mientras tanto.
pub fn execute(plan: &Plan, permanent: bool, backups_dir: &Path) -> Result<Outcome> {
    let mut outcome = Outcome::default();
    let mut configs: HashSet<PathBuf> = plan.items.iter().filter_map(config_dir_of_item).collect();
    configs.extend(plan.history.iter().filter_map(|h| h.file.parent().map(Path::to_path_buf)));
    let planned: HashSet<Uuid> = plan.items.iter().map(|i| i.session).collect();
    for config in &configs {
        if let Some(open) = open_sessions(config).into_iter().find(|id| planned.contains(id)) {
            return Err(Error::Other(format!("La sesión {open} está abierta en Claude Code. Ciérrala en la terminal primero.")));
        }
    }

    // Primero el historial (con copia): si falla, no se ha borrado nada.
    for edit in &plan.history {
        let wanted: HashSet<Uuid> = edit.sessions.iter().copied().collect();
        outcome.backups.push(rewrite_history(&edit.file, &wanted, backups_dir)?);
    }

    let mut failed: HashSet<Uuid> = HashSet::new();
    for item in &plan.items {
        let result = if permanent { remove(&item.path) } else { trash::delete(&item.path).map_err(|e| e.to_string()) };
        if let Err(error) = result {
            failed.insert(item.session);
            outcome.failures.push(format!("{}: {error}", item.path.display()));
        }
    }
    let mut deleted: Vec<Uuid> = planned.into_iter().filter(|id| !failed.contains(id)).collect();
    deleted.sort();
    outcome.deleted = deleted;
    Ok(outcome)
}

fn config_dir_of_item(item: &PlanItem) -> Option<PathBuf> {
    match item.kind {
        ItemKind::Conversation => config_dir_of(&item.path),
        ItemKind::Subagents => config_dir_of(&item.path.with_extension("jsonl")),
        _ => item.path.parent()?.parent().map(Path::to_path_buf),
    }
}

fn remove(path: &Path) -> std::result::Result<(), String> {
    let result = if path.is_dir() { std::fs::remove_dir_all(path) } else { std::fs::remove_file(path) };
    result.map_err(|e| e.to_string())
}

/// Todos los archivos de una sesión en una carpeta `projects`: la original y las copias que deja
/// «Elegir carpeta…» o importar en otra carpeta de proyecto.
pub fn find_copies(projects_dir: &Path, id: Uuid) -> Vec<PathBuf> {
    let name = format!("{id}.jsonl");
    let Ok(folders) = std::fs::read_dir(projects_dir) else { return vec![] };
    let mut found: Vec<PathBuf> = folders.flatten().map(|f| f.path().join(&name)).filter(|p| p.is_file()).collect();
    found.sort();
    found
}

// MARK: Sesiones abiertas

/// Sesiones con un proceso de Claude Code vivo (`sessions/<pid>.json`).
pub fn open_sessions(config: &Path) -> HashSet<Uuid> {
    let Ok(entries) = std::fs::read_dir(config.join("sessions")) else { return HashSet::new() };
    entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
        .filter_map(|e| {
            let value: Value = serde_json::from_slice(&std::fs::read(e.path()).ok()?).ok()?;
            let id = Uuid::parse_str(value.get("sessionId")?.as_str()?).ok()?;
            let pid = value.get("pid")?.as_u64()? as u32;
            process_alive(pid).then_some(id)
        })
        .collect()
}

#[cfg(unix)]
fn process_alive(pid: u32) -> bool {
    // `kill -0` no envía nada: solo comprueba que el proceso existe.
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

#[cfg(windows)]
fn process_alive(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH", "/FO", "CSV"])
        .creation_flags(0x0800_0000)
        .output()
        .is_ok_and(|o| String::from_utf8_lossy(&o.stdout).contains(&format!("\"{pid}\"")))
}

// MARK: history.jsonl

fn line_session(line: &str) -> Option<Uuid> {
    let value: Value = serde_json::from_str(line).ok()?;
    Uuid::parse_str(value.get("sessionId")?.as_str()?).ok()
}

fn count_history(file: &Path, wanted: &HashSet<Uuid>) -> (usize, Vec<Uuid>) {
    let Ok(text) = std::fs::read_to_string(file) else { return (0, vec![]) };
    let mut found: HashSet<Uuid> = HashSet::new();
    let mut lines = 0;
    for line in text.lines() {
        if let Some(id) = line_session(line).filter(|id| wanted.contains(id)) {
            lines += 1;
            found.insert(id);
        }
    }
    let mut sessions: Vec<Uuid> = found.into_iter().collect();
    sessions.sort();
    (lines, sessions)
}

/// Reescribe `history.jsonl` sin las líneas de esas sesiones. Antes guarda una copia y devuelve su
/// ruta. Las líneas que no se entienden se conservan tal cual.
pub fn rewrite_history(file: &Path, wanted: &HashSet<Uuid>, backups_dir: &Path) -> Result<PathBuf> {
    let text = std::fs::read_to_string(file)?;
    std::fs::create_dir_all(backups_dir)?;
    let stamp = chrono::Local::now().format("%Y-%m-%d-%H%M%S");
    let account = file.parent().and_then(|p| p.file_name()).map(|n| n.to_string_lossy().trim_start_matches('.').to_owned()).unwrap_or_default();
    let backup = backups_dir.join(format!("history-{account}-{stamp}.jsonl"));
    std::fs::copy(file, &backup)?;
    let mut kept = String::with_capacity(text.len());
    for line in text.split_inclusive('\n') {
        if line_session(line.trim_end()).is_some_and(|id| wanted.contains(&id)) {
            continue;
        }
        kept.push_str(line);
    }
    let tmp = file.with_extension("jsonl.lostandprompt-tmp");
    std::fs::write(&tmp, kept)?;
    std::fs::rename(&tmp, file)?;
    Ok(backup)
}

// MARK: Ayudantes

fn prefix(id: Uuid) -> String {
    id.to_string()[..8].to_owned()
}

fn all_session_ids(config: &Path) -> Vec<Uuid> {
    let Ok(folders) = std::fs::read_dir(config.join("projects")) else { return vec![] };
    folders
        .flatten()
        .filter_map(|f| std::fs::read_dir(f.path()).ok())
        .flat_map(|items| items.flatten())
        .filter_map(|item| {
            let path = item.path();
            if path.extension()? != "jsonl" {
                return None;
            }
            Uuid::parse_str(path.file_stem()?.to_str()?).ok()
        })
        .collect()
}

fn size_of(path: &Path) -> u64 {
    let Ok(meta) = std::fs::symlink_metadata(path) else { return 0 };
    if !meta.is_dir() {
        return meta.len();
    }
    std::fs::read_dir(path).map(|entries| entries.flatten().map(|e| size_of(&e.path())).sum()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const B: &str = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const C: &str = "11111111-cccc-4ccc-8ccc-cccccccccccc"; // mismo prefijo que A

    fn write(path: &Path, text: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, text).unwrap();
    }

    /// Carpeta de configuración falsa con tres sesiones.
    fn fake() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join(".claude");
        let project = config.join("projects/-Users-ana-web");
        for id in [A, B, C] {
            write(&project.join(format!("{id}.jsonl")), "{\"type\":\"user\"}\n");
        }
        write(&project.join(A).join("subagents/agent-1.jsonl"), "x".repeat(100).as_str());
        write(&config.join("file-history").join(A).join("f@v1"), "copia");
        write(&config.join("session-env").join(A).join("env"), "");
        write(&config.join("tasks/session-22222222/1.json"), "{}");
        write(&config.join("todos").join(format!("{A}-agent-{A}.json")), "[]");
        let history = format!(
            "{{\"display\":\"hola\",\"sessionId\":\"{A}\"}}\n{{\"display\":\"otra\",\"sessionId\":\"{B}\"}}\nlínea rota\n{{\"display\":\"más\",\"sessionId\":\"{A}\"}}\n"
        );
        write(&config.join("history.jsonl"), &history);
        (dir, config)
    }

    fn target(config: &Path, id: &str) -> Target {
        Target { id: Uuid::parse_str(id).unwrap(), file: config.join("projects/-Users-ana-web").join(format!("{id}.jsonl")) }
    }

    #[test]
    fn planea_todo_lo_de_la_sesion() {
        let (_dir, config) = fake();
        let plan = plan_delete(&[target(&config, A)]);
        let kinds: Vec<ItemKind> = plan.items.iter().map(|i| i.kind).collect();
        // La carpeta de tareas session-11111111 no existe y además C comparte prefijo: no se toca.
        assert_eq!(kinds, vec![ItemKind::Conversation, ItemKind::Subagents, ItemKind::FileHistory, ItemKind::Environment, ItemKind::Todos]);
        assert_eq!(plan.history_lines(), 2);
        assert!(plan.total_bytes >= 100);
        assert!(plan.in_use.is_empty());
    }

    #[test]
    fn tareas_solo_si_nadie_comparte_el_prefijo() {
        let (_dir, config) = fake();
        let plan = plan_delete(&[target(&config, B)]);
        assert!(plan.items.iter().any(|i| i.kind == ItemKind::Tasks));
    }

    #[test]
    fn borra_y_limpia_el_historial_con_copia() {
        let (dir, config) = fake();
        let backups = dir.path().join("copias");
        let plan = plan_delete(&[target(&config, A)]);
        let outcome = execute(&plan, true, &backups).unwrap();
        assert_eq!(outcome.deleted, vec![Uuid::parse_str(A).unwrap()]);
        assert!(outcome.failures.is_empty());
        assert!(!config.join(format!("projects/-Users-ana-web/{A}.jsonl")).exists());
        assert!(!config.join("projects/-Users-ana-web").join(A).exists());
        assert!(!config.join("file-history").join(A).exists());
        assert!(config.join(format!("projects/-Users-ana-web/{B}.jsonl")).exists());
        let history = std::fs::read_to_string(config.join("history.jsonl")).unwrap();
        assert_eq!(history, format!("{{\"display\":\"otra\",\"sessionId\":\"{B}\"}}\nlínea rota\n"));
        let backup = std::fs::read_to_string(&outcome.backups[0]).unwrap();
        assert!(backup.contains("hola"));
    }

    #[test]
    fn no_toca_una_sesion_abierta() {
        let (dir, config) = fake();
        // Este mismo proceso de pruebas hace de Claude Code con la sesión A abierta.
        let pid = std::process::id();
        write(&config.join(format!("sessions/{pid}.json")), &format!("{{\"pid\":{pid},\"sessionId\":\"{A}\"}}"));
        let plan = plan_delete(&[target(&config, A), target(&config, B)]);
        assert_eq!(plan.in_use, vec![Uuid::parse_str(A).unwrap()]);
        assert!(plan.items.iter().all(|i| i.session != Uuid::parse_str(A).unwrap()));
        assert_eq!(plan.history_lines(), 1);
        execute(&plan, true, &dir.path().join("copias")).unwrap();
        assert!(config.join(format!("projects/-Users-ana-web/{A}.jsonl")).exists());
    }

    #[test]
    fn un_proceso_muerto_no_bloquea() {
        let (_dir, config) = fake();
        write(&config.join("sessions/999999.json"), &format!("{{\"pid\":999999,\"sessionId\":\"{A}\"}}"));
        assert!(plan_delete(&[target(&config, A)]).in_use.is_empty());
    }

    #[test]
    fn carpeta_de_configuracion() {
        assert_eq!(config_dir_of(Path::new("/h/.claude-x/projects/-h/1.jsonl")), Some(PathBuf::from("/h/.claude-x")));
        assert_eq!(config_dir_of(Path::new("/h/otra/-h/1.jsonl")), None);
    }
}
