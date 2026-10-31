//! Lectura tolerante y de solo lectura de las sesiones de Claude Code.
//!
//! El formato es interno y cambia entre versiones: todo campo es opcional y los tipos de
//! registro desconocidos se ignoran. Las líneas se recorren sin copiar (`memchr`) y solo se
//! interpreta el JSON de las que hacen falta, porque hay sesiones de cientos de MB.

use std::collections::HashMap;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use chrono::{DateTime, Utc};
use memchr::memmem;
use rayon::prelude::*;
use serde_json::Value;
use uuid::Uuid;

use crate::model::{Message, Role, SessionSummary};

const ASSISTANT: &[u8] = br#""type":"assistant""#;
const USER: &[u8] = br#""type":"user""#;
const AI_TITLE: &[u8] = br#""type":"ai-title""#;
const SUMMARY: &[u8] = br#""type":"summary""#;
const COST_STATE: &[u8] = br#""type":"cost-state""#;
const TOOL_RESULT: &[u8] = br#""tool_use_id""#;

/// Codifica un directorio como lo hace Claude Code para nombrar la carpeta del proyecto:
/// todo lo que no sea letra o dígito ASCII se cambia por `-`.
pub fn encode_project_dir(path: &str) -> String {
    path.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

/// Escanea todas las sesiones en paralelo. Si se da `cache`, reutiliza los resúmenes de los
/// archivos que no cambiaron (mismo tamaño y fecha) y guarda la caché actualizada.
pub fn scan(projects_dir: &Path, cache: Option<&Path>) -> Vec<SessionSummary> {
    scan_many(&[projects_dir.to_path_buf()], cache)
}

/// Como [`scan`], pero sobre varias carpetas de proyectos a la vez (por ejemplo, la de Windows y
/// las de cada distribución de WSL), con una sola caché.
pub fn scan_many(projects_dirs: &[PathBuf], cache: Option<&Path>) -> Vec<SessionSummary> {
    let previous: HashMap<String, SessionSummary> = cache
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|data| serde_json::from_slice(&data).ok())
        .unwrap_or_default();

    let files: Vec<_> = projects_dirs.iter().flat_map(|dir| session_files(dir)).collect();
    let results: Vec<SessionSummary> = files
        .into_par_iter()
        .filter_map(|(path, size, modified)| {
            let key = path.to_string_lossy().into_owned();
            match previous.get(&key) {
                Some(cached) if cached.size == size && cached.modified == modified => Some(cached.clone()),
                _ => summarize(&path, size, modified),
            }
        })
        .collect();

    if let Some(cache) = cache {
        let map: HashMap<&str, &SessionSummary> = results.iter().map(|s| (s.path.as_str(), s)).collect();
        if let Ok(data) = serde_json::to_vec(&map) {
            if let Some(parent) = cache.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = write_atomic(cache, &data);
        }
    }
    results
}

fn session_files(projects_dir: &Path) -> Vec<(PathBuf, u64, DateTime<Utc>)> {
    let Ok(folders) = std::fs::read_dir(projects_dir) else { return vec![] };
    let mut files = vec![];
    for folder in folders.flatten() {
        let Ok(items) = std::fs::read_dir(folder.path()) else { continue };
        for item in items.flatten() {
            let path = item.path();
            let is_session = path.extension().is_some_and(|e| e == "jsonl")
                && path.file_stem().and_then(|s| s.to_str()).is_some_and(|s| Uuid::parse_str(s).is_ok());
            if !is_session {
                continue;
            }
            let Ok(meta) = item.metadata() else { continue };
            let modified: DateTime<Utc> = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH).into();
            files.push((path, meta.len(), modified));
        }
    }
    files
}

/// Resume un archivo de sesión.
pub fn summarize(path: &Path, size: u64, modified: DateTime<Utc>) -> Option<SessionSummary> {
    let id = Uuid::parse_str(path.file_stem()?.to_str()?).ok()?;
    let data = map_file(path)?;
    let mut summary = SessionSummary {
        id,
        path: path.to_string_lossy().into_owned(),
        size,
        modified,
        ai_title: None,
        cwd: None,
        git_branch: None,
        started_at: None,
        user_messages: 0,
        assistant_messages: 0,
        cost_usd: None,
        model: None,
        first_prompt: None,
        last_reply: None,
    };
    let mut recent_assistant: Vec<(usize, usize)> = Vec::with_capacity(13);
    let mut directories: Vec<String> = vec![];

    for (start, end) in lines(&data) {
        let line = &data[start..end];
        if contains(line, ASSISTANT) {
            summary.assistant_messages += 1;
            recent_assistant.push((start, end));
            if recent_assistant.len() > 12 {
                recent_assistant.remove(0);
            }
        } else if contains(line, USER) {
            if contains(line, TOOL_RESULT) {
                continue;
            }
            let Some(object) = json(line) else { continue };
            if let Some(cwd) = object.get("cwd").and_then(Value::as_str) {
                if directories.len() < 20 && !directories.iter().any(|d| d == cwd) {
                    directories.push(cwd.to_owned());
                }
            }
            if summary.git_branch.is_none() {
                summary.git_branch = object.get("gitBranch").and_then(Value::as_str).map(str::to_owned);
            }
            if summary.started_at.is_none() {
                summary.started_at = date(object.get("timestamp"));
            }
            let Some(text) = human_text(&object) else { continue };
            summary.user_messages += 1;
            if summary.first_prompt.is_none() {
                summary.first_prompt = Some(text.chars().take(400).collect());
            }
        } else if contains(line, AI_TITLE) {
            summary.ai_title = json(line).and_then(|o| o.get("aiTitle").and_then(Value::as_str).map(str::to_owned));
        } else if contains(line, SUMMARY) {
            if summary.ai_title.is_none() {
                summary.ai_title = json(line).and_then(|o| o.get("summary").and_then(Value::as_str).map(str::to_owned));
            }
        } else if contains(line, COST_STATE) {
            summary.cost_usd = json(line).and_then(|o| o.get("totalCostUSD").and_then(Value::as_f64));
        }
    }

    // El cwd válido es el que corresponde a la carpeta donde vive el archivo; si ninguno
    // coincide (formato desconocido), el primero.
    let folder = path.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str()).unwrap_or_default();
    summary.cwd = directories
        .iter()
        .find(|d| encode_project_dir(d) == folder)
        .or(directories.first())
        .cloned();

    for &(start, end) in recent_assistant.iter().rev() {
        let Some(message) = json(&data[start..end]).and_then(|o| o.get("message").cloned()) else { continue };
        if summary.model.is_none() {
            summary.model = message.get("model").and_then(Value::as_str).map(str::to_owned);
        }
        if summary.last_reply.is_none() {
            summary.last_reply = texts(&message).last().map(|t| t.chars().take(400).collect());
        }
        if summary.model.is_some() && summary.last_reply.is_some() {
            break;
        }
    }
    Some(summary)
}

/// Conversación completa: tus mensajes y las respuestas de Claude, con el número de
/// herramientas que usó en cada paso.
pub fn messages(path: &Path) -> Vec<Message> {
    let Some(data) = map_file(path) else { return vec![] };
    let mut result: Vec<Message> = vec![];
    for (start, end) in lines(&data) {
        let line = &data[start..end];
        if contains(line, ASSISTANT) {
            let Some(object) = json(line) else { continue };
            let when = date(object.get("timestamp"));
            let blocks = object.pointer("/message/content").and_then(Value::as_array).cloned().unwrap_or_default();
            for block in blocks {
                match block.get("type").and_then(Value::as_str) {
                    Some("text") => {
                        if let Some(text) = block.get("text").and_then(Value::as_str) {
                            if !text.trim().is_empty() {
                                result.push(Message { role: Role::Assistant, date: when, text: text.to_owned(), tool_count: 0 });
                            }
                        }
                    }
                    Some("tool_use") => match result.last_mut() {
                        Some(last) if last.role == Role::Assistant => last.tool_count += 1,
                        _ => result.push(Message { role: Role::Assistant, date: when, text: String::new(), tool_count: 1 }),
                    },
                    _ => {}
                }
            }
        } else if contains(line, USER) && !contains(line, TOOL_RESULT) {
            let Some(object) = json(line) else { continue };
            if let Some(text) = human_text(&object) {
                result.push(Message { role: Role::User, date: date(object.get("timestamp")), text, tool_count: 0 });
            }
        }
    }
    result
}

// MARK: Ayudantes

fn map_file(path: &Path) -> Option<memmap2::Mmap> {
    let file = File::open(path).ok()?;
    if file.metadata().ok()?.len() == 0 {
        return None;
    }
    // SAFETY: solo lectura; si Claude Code añade líneas mientras leemos, como mucho se pierde
    // la última línea incompleta, que la próxima lectura recoge.
    unsafe { memmap2::Mmap::map(&file).ok() }
}

/// Rangos `[inicio, fin)` de cada línea no vacía.
fn lines(data: &[u8]) -> impl Iterator<Item = (usize, usize)> + '_ {
    let mut start = 0;
    std::iter::from_fn(move || {
        while start < data.len() {
            let end = memchr::memchr(b'\n', &data[start..]).map_or(data.len(), |i| start + i);
            let range = (start, end);
            start = end + 1;
            if range.1 > range.0 {
                return Some(range);
            }
        }
        None
    })
}

fn contains(line: &[u8], marker: &[u8]) -> bool {
    memmem::find(line, marker).is_some()
}

fn json(line: &[u8]) -> Option<Value> {
    serde_json::from_slice(line).ok()
}

/// Texto escrito por la persona; descarta recordatorios del sistema, comandos y mensajes internos.
fn human_text(object: &Value) -> Option<String> {
    if object.get("isMeta").and_then(Value::as_bool) == Some(true)
        || object.get("isSidechain").and_then(Value::as_bool) == Some(true)
    {
        return None;
    }
    let message = object.get("message")?;
    let text = match message.get("content") {
        Some(Value::String(s)) => s.clone(),
        _ => texts(message).join("\n"),
    };
    let trimmed = text.trim();
    if trimmed.is_empty() || trimmed.starts_with('<') || trimmed.starts_with("[Request interrupted") {
        return None;
    }
    Some(trimmed.to_owned())
}

fn texts(message: &Value) -> Vec<String> {
    message
        .get("content")
        .and_then(Value::as_array)
        .map(|blocks| {
            blocks
                .iter()
                .filter(|b| b.get("type").and_then(Value::as_str) == Some("text"))
                .filter_map(|b| b.get("text").and_then(Value::as_str).map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

fn date(value: Option<&Value>) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value?.as_str()?).ok().map(|d| d.with_timezone(&Utc))
}

pub(crate) fn write_atomic(path: &Path, data: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, data)?;
    std::fs::rename(tmp, path)
}
