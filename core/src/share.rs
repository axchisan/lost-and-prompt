//! Compartir sesiones para continuarlas en otro equipo.
//!
//! El formato propio es un paquete `.lap` (un zip) con:
//!
//! ```text
//! manifest.json        qué es: título, carpeta, git, sistema de origen, opciones de exportación
//! session.jsonl        la sesión de Claude Code
//! conversation.md      la conversación para leer, para quien no tenga la app
//! files/subagents/…    lo que hay junto a la sesión (`<id>/`): subagentes…
//! files/tool-results/… …y las salidas largas de las herramientas
//! ```
//!
//! También se importa un `.jsonl` suelto (lo que exportaban las versiones anteriores). La sesión se
//! copia en la carpeta de proyecto que elija quien la recibe, donde `claude --resume` la busca.

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::LazyLock;

use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::store::encode_project_dir;

/// Extensión de los paquetes de Lost & Prompt.
pub const EXTENSION: &str = "lap";
/// Versión del formato. Una app que lee una versión mayor avisa en lugar de importar a medias.
pub const FORMAT: u32 = 1;
/// Lo que queda en lugar de una salida de herramienta cuando se exporta sin ellas.
pub const OMITTED: &str = "[Omitido al compartir con Lost & Prompt]";
/// Lo que queda en lugar de una clave tapada.
pub const REDACTED: &str = "[CLAVE-TAPADA]";

/// Límite de lo que se descomprime al importar, para no llenar el disco con un archivo malicioso.
const MAX_UNPACKED: u64 = 2 << 30;
const MAX_ENTRIES: usize = 20_000;

/// Qué es un paquete: va en `manifest.json`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Manifest {
    pub format: u32,
    /// App y versión que lo creó («Lost & Prompt 0.12.0»).
    pub app: String,
    pub exported_at: Option<DateTime<Utc>>,
    /// Sistema de origen: `macos`, `windows` o `linux`.
    pub os: String,
    pub session_id: Uuid,
    pub title: Option<String>,
    pub note: Option<String>,
    /// Carpeta donde se trabajó en el equipo de origen.
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    /// `remote.origin.url` del proyecto, sin usuario ni contraseña: sirve para encontrar la misma
    /// carpeta en el equipo de quien lo recibe.
    pub git_remote: Option<String>,
    pub model: Option<String>,
    pub messages: u32,
    pub started_at: Option<DateTime<Utc>>,
    pub last_activity: Option<DateTime<Utc>>,
    /// Si lleva lo que leyeron y devolvieron las herramientas.
    pub tool_output: bool,
    /// Claves tapadas al exportar.
    pub redacted: u32,
    /// Carpeta de los archivos de la sesión en el equipo de origen (`…/projects/<carpeta>/<id>`),
    /// para que las referencias a `tool-results` apunten a su sitio nuevo al importar.
    pub source_dir: Option<String>,
}

/// Lo que se sabe de un archivo compartido antes de importarlo.
#[derive(Debug, Clone, PartialEq)]
pub struct SharedFile {
    pub manifest: Manifest,
    /// `true` si es un paquete `.lap`; `false` si es un `.jsonl` suelto.
    pub packaged: bool,
}

/// Opciones al exportar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExportOptions {
    /// Incluir lo que leyeron y devolvieron las herramientas (por defecto, sí).
    pub tool_output: bool,
    /// Tapar las claves encontradas.
    pub redact: bool,
}

impl Default for ExportOptions {
    fn default() -> Self {
        Self { tool_output: true, redact: true }
    }
}

// MARK: Leer

/// Lee el id y la carpeta de un `.jsonl` de sesión de Claude Code. Falla si no lo es.
fn inspect_jsonl(path: &Path) -> Result<Manifest, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("No se pudo abrir el archivo: {e}"))?;
    let mut manifest = Manifest { format: FORMAT, tool_output: true, ..Manifest::default() };
    let mut id = None;
    // Las primeras líneas bastan: todas las de mensajes llevan sessionId y cwd.
    for line in BufReader::new(file).lines().take(400).map_while(Result::ok) {
        let Ok(object) = serde_json::from_str::<Value>(&line) else { continue };
        if id.is_none() {
            id = object.get("sessionId").and_then(Value::as_str).and_then(|s| Uuid::parse_str(s).ok());
        }
        if manifest.cwd.is_none() {
            manifest.cwd = object.get("cwd").and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_owned);
        }
        if manifest.title.is_none() && object.get("type").and_then(Value::as_str) == Some("ai-title") {
            manifest.title = object.get("aiTitle").and_then(Value::as_str).map(str::to_owned);
        }
    }
    manifest.session_id = id.ok_or("El archivo no es una sesión de Claude Code.")?;
    Ok(manifest)
}

fn is_package(path: &Path) -> bool {
    let mut magic = [0u8; 4];
    std::fs::File::open(path).and_then(|mut f| f.read_exact(&mut magic)).is_ok() && magic == *b"PK\x03\x04"
}

fn open_zip(path: &Path) -> Result<zip::ZipArchive<std::fs::File>, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("No se pudo abrir el archivo: {e}"))?;
    zip::ZipArchive::new(file).map_err(|_| "El archivo está dañado o no es un paquete de Lost & Prompt.".to_string())
}

fn read_manifest(archive: &mut zip::ZipArchive<std::fs::File>) -> Result<Manifest, String> {
    let not_ours = || "El archivo no es una sesión de Lost & Prompt.".to_string();
    let mut text = String::new();
    archive.by_name("manifest.json").map_err(|_| not_ours())?.take(1 << 20).read_to_string(&mut text).map_err(|_| not_ours())?;
    let manifest: Manifest = serde_json::from_str(&text).map_err(|_| not_ours())?;
    if manifest.format > FORMAT {
        return Err("La sesión se exportó con una versión más nueva de Lost & Prompt. Actualiza la app para importarla.".into());
    }
    if archive.by_name("session.jsonl").is_err() || manifest.session_id.is_nil() {
        return Err(not_ours());
    }
    Ok(manifest)
}

/// Lee lo que trae un archivo compartido: un paquete `.lap` o un `.jsonl` suelto.
pub fn inspect(path: &Path) -> Result<SharedFile, String> {
    if is_package(path) {
        let manifest = read_manifest(&mut open_zip(path)?)?;
        Ok(SharedFile { manifest, packaged: true })
    } else {
        Ok(SharedFile { manifest: inspect_jsonl(path)?, packaged: false })
    }
}

// MARK: Claves

struct SecretPattern {
    kind: &'static str,
    regex: Regex,
    /// Grupo que se tapa (0 = todo lo encontrado).
    group: usize,
}

/// Formatos de claves conocidos. Las clases de caracteres excluyen `"` y `\` para que tapar una
/// clave nunca corte un escape de JSON.
static SECRETS: LazyLock<Vec<SecretPattern>> = LazyLock::new(|| {
    let p = |kind, pattern: &str, group| SecretPattern { kind, regex: Regex::new(pattern).unwrap(), group };
    vec![
        p("anthropic", r"sk-ant-[A-Za-z0-9_\-]{20,}", 0),
        p("openai", r"sk-(?:proj|svcacct|admin)-[A-Za-z0-9_\-]{20,}", 0),
        p("github", r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}", 0),
        p("aws", r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b", 0),
        p("google", r"AIza[0-9A-Za-z_\-]{35}", 0),
        p("slack", r"xox[abprs]-[A-Za-z0-9\-]{10,}", 0),
        p("stripe", r"(?:sk|rk)_live_[A-Za-z0-9]{20,}", 0),
        p("resend", r"\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}", 0),
        p("npm", r"\bnpm_[A-Za-z0-9]{36}\b", 0),
        p("huggingface", r"\bhf_[A-Za-z0-9]{30,}\b", 0),
        p("privateKey", r"-----BEGIN [A-Z ]*PRIVATE KEY-----[^\x22]*?-----END [A-Z ]*PRIVATE KEY-----", 0),
        p("jwt", r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}", 0),
        p("databaseUrl", r"(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?)://[^:/\s\x22\\@]+:([^@\s\x22\\]+)@", 1),
    ]
});

/// Cuenta las claves de un texto por tipo y, si `redact`, las tapa.
fn find_secrets(text: &str, counts: &mut BTreeMap<String, u32>, redact: bool) -> Option<String> {
    let mut out: Option<String> = None;
    for pattern in SECRETS.iter() {
        let current = out.as_deref().unwrap_or(text);
        let mut found = 0;
        let replaced = pattern.regex.replace_all(current, |caps: &regex::Captures| {
            let whole = caps.get(0).unwrap();
            let target = caps.get(pattern.group).unwrap_or(whole);
            // Lo ya tapado no vuelve a contar.
            if target.as_str() == REDACTED {
                return whole.as_str().to_owned();
            }
            found += 1;
            let start = target.start() - whole.start();
            let end = target.end() - whole.start();
            format!("{}{REDACTED}{}", &whole.as_str()[..start], &whole.as_str()[end..])
        });
        if found > 0 {
            *counts.entry(pattern.kind.to_owned()).or_default() += found;
            if redact {
                out = Some(replaced.into_owned());
            }
        }
    }
    out
}

/// Archivos que forman una sesión: el `.jsonl` y lo que haya en su carpeta `<id>/`.
fn session_files(session: &Path) -> Vec<(PathBuf, String)> {
    let mut files = vec![];
    let dir = session.with_extension("");
    fn walk(base: &Path, dir: &Path, files: &mut Vec<(PathBuf, String)>) {
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(base, &path, files);
            } else if let Ok(relative) = path.strip_prefix(base) {
                let name = relative.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
                files.push((path, name));
            }
        }
    }
    walk(&dir, &dir, &mut files);
    files.sort_by(|a, b| a.1.cmp(&b.1));
    files
}

fn is_text(name: &str) -> bool {
    [".jsonl", ".json", ".txt", ".md", ".log"].iter().any(|ext| name.ends_with(ext))
}

/// Claves que se encontraron en la sesión (también en sus subagentes y salidas guardadas), por tipo.
pub fn scan_secrets(session: &Path, tool_output: bool) -> BTreeMap<String, u32> {
    let mut counts = BTreeMap::new();
    let mut scan = |path: &Path, is_session_log: bool| {
        let Ok(file) = std::fs::File::open(path) else { return };
        for line in BufReader::new(file).lines().map_while(Result::ok) {
            let line = if is_session_log && !tool_output {
                match strip_tool_output(&line) {
                    Some(stripped) => stripped,
                    None => continue,
                }
            } else {
                line
            };
            find_secrets(&line, &mut counts, false);
        }
    };
    scan(session, true);
    for (path, name) in session_files(session) {
        if name.starts_with("tool-results/") && !tool_output {
            continue;
        }
        if is_text(&name) {
            scan(&path, name.ends_with(".jsonl"));
        }
    }
    counts
}

// MARK: Exportar

/// Una línea de la sesión sin lo que devolvieron las herramientas. `None` = la línea sobra.
fn strip_tool_output(line: &str) -> Option<String> {
    let suspect = ["tool_result", "toolUseResult", "api-request"].iter().any(|m| line.contains(m));
    if !suspect {
        return Some(line.to_owned());
    }
    let Ok(mut object) = serde_json::from_str::<Value>(line) else { return Some(line.to_owned()) };
    let kind = object.get("type").and_then(Value::as_str).unwrap_or_default();
    // Copias de las peticiones a la API: repiten todo lo que leyeron las herramientas y Claude
    // Code no las necesita para reanudar.
    if kind.starts_with("api-request") {
        return None;
    }
    if let Some(map) = object.as_object_mut() {
        if map.remove("toolUseResult").is_some() {
            map.insert("toolUseResult".into(), Value::String(OMITTED.into()));
        }
    }
    if let Some(blocks) = object.pointer_mut("/message/content").and_then(Value::as_array_mut) {
        for block in blocks {
            if block.get("type").and_then(Value::as_str) == Some("tool_result") {
                block["content"] = Value::String(OMITTED.into());
            }
        }
    }
    Some(object.to_string())
}

/// Prepara un archivo de texto de la sesión según las opciones. Devuelve las claves tapadas.
fn transform(text: &str, is_session_log: bool, options: ExportOptions, counts: &mut BTreeMap<String, u32>) -> String {
    let mut out = String::with_capacity(text.len());
    for line in text.split_inclusive('\n') {
        let (body, newline) = line.strip_suffix('\n').map_or((line, ""), |b| (b, "\n"));
        let body = if is_session_log && !options.tool_output {
            match strip_tool_output(body) {
                Some(stripped) => stripped,
                None => continue,
            }
        } else {
            body.to_owned()
        };
        let body = find_secrets(&body, counts, options.redact).unwrap_or(body);
        out.push_str(&body);
        out.push_str(newline);
    }
    out
}

/// `remote.origin.url` de un proyecto, sin credenciales.
pub fn git_remote(folder: &Path) -> Option<String> {
    let config = std::fs::read_to_string(folder.join(".git").join("config")).ok()?;
    let mut in_origin = false;
    for line in config.lines().map(str::trim) {
        if line.starts_with('[') {
            in_origin = line == r#"[remote "origin"]"#;
        } else if in_origin {
            if let Some(url) = line.strip_prefix("url").map(str::trim_start).and_then(|l| l.strip_prefix('=')) {
                return Some(clean_remote(url.trim()));
            }
        }
    }
    None
}

/// Quita usuario y contraseña de una URL de git (`https://token@github.com/…`).
fn clean_remote(url: &str) -> String {
    match url.split_once("://") {
        Some((scheme, rest)) => match rest.split_once('@') {
            Some((userinfo, host)) if !userinfo.contains('/') => format!("{scheme}://{host}"),
            _ => url.to_owned(),
        },
        None => url.to_owned(),
    }
}

/// La misma URL de git escrita de distintas formas (`git@github.com:a/b.git`,
/// `https://github.com/a/b`) queda igual, para compararlas.
pub fn normalize_remote(url: &str) -> String {
    let url = clean_remote(url.trim()).to_lowercase();
    let url = url.split_once("://").map_or(url.as_str(), |(_, rest)| rest).to_owned();
    let url = url.strip_prefix("git@").map(|rest| rest.replacen(':', "/", 1)).unwrap_or(url);
    url.trim_end_matches('/').trim_end_matches(".git").to_owned()
}

/// Crea el paquete `.lap` de una sesión en `destination`. `manifest` llega con los datos de la
/// sesión (título, nota, carpeta…); aquí se completan el formato, las opciones y las claves tapadas.
pub fn export(session: &Path, destination: &Path, mut manifest: Manifest, markdown: &str, options: ExportOptions) -> Result<Manifest, String> {
    let text = std::fs::read_to_string(session).map_err(|e| format!("No se pudo leer la sesión: {e}"))?;
    let mut counts = BTreeMap::new();
    let log = transform(&text, true, options, &mut counts);

    manifest.format = FORMAT;
    manifest.tool_output = options.tool_output;
    if manifest.os.is_empty() {
        manifest.os = std::env::consts::OS.to_owned();
    }
    manifest.exported_at.get_or_insert_with(Utc::now);
    if manifest.git_remote.is_none() {
        manifest.git_remote = manifest.cwd.as_deref().and_then(|cwd| git_remote(Path::new(cwd)));
    }
    let extra = session_files(session);
    if !extra.is_empty() {
        manifest.source_dir = Some(session.with_extension("").to_string_lossy().into_owned());
    }

    // Se escribe al lado y se renombra al final: si algo falla no queda un paquete a medias.
    let partial = destination.with_extension("lap-partial");
    let result = (|| -> Result<(), String> {
        let file = std::fs::File::create(&partial).map_err(|e| format!("No se pudo crear el archivo: {e}"))?;
        let mut zip = zip::ZipWriter::new(file);
        let options_zip = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        let mut add = |name: &str, data: &[u8]| -> Result<(), String> {
            zip.start_file(name, options_zip).map_err(|e| e.to_string())?;
            zip.write_all(data).map_err(|e| e.to_string())
        };
        add("session.jsonl", log.as_bytes())?;
        for (path, name) in &extra {
            if name.starts_with("tool-results/") && !options.tool_output {
                continue;
            }
            let data = std::fs::read(path).map_err(|e| e.to_string())?;
            let data = match (is_text(name), String::from_utf8(data)) {
                (true, Ok(text)) => transform(&text, name.ends_with(".jsonl"), options, &mut counts).into_bytes(),
                (_, Ok(text)) => text.into_bytes(),
                (_, Err(bytes)) => bytes.into_bytes(),
            };
            add(&format!("files/{name}"), &data)?;
        }
        let markdown = find_secrets(markdown, &mut BTreeMap::new(), options.redact).unwrap_or_else(|| markdown.to_owned());
        add("conversation.md", markdown.as_bytes())?;
        manifest.redacted = if options.redact { counts.values().sum() } else { 0 };
        let json = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
        add("manifest.json", &json)?;
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })();
    match result {
        Ok(()) => {
            std::fs::rename(&partial, destination).map_err(|e| e.to_string())?;
            Ok(manifest)
        }
        Err(error) => {
            let _ = std::fs::remove_file(&partial);
            Err(error)
        }
    }
}

// MARK: Importar

/// Ruta dentro del paquete → ruta relativa segura (sin `..`, sin raíz ni unidad).
fn safe_relative(name: &str) -> Option<PathBuf> {
    let path = Path::new(name);
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    (!out.as_os_str().is_empty() && !name.contains('\\')).then_some(out)
}

/// Cambia en todos los textos de un valor JSON la carpeta de origen por la nueva, con los
/// separadores del sistema donde se importa.
fn rewrite_paths(value: &mut Value, from: &str, to: &str) -> bool {
    match value {
        Value::String(text) if text.contains(from) => {
            let mut out = String::with_capacity(text.len());
            let mut rest = text.as_str();
            while let Some(index) = rest.find(from) {
                out.push_str(&rest[..index]);
                out.push_str(to);
                rest = &rest[index + from.len()..];
                // El resto de la ruta, hasta un espacio o una comilla, con el separador de aquí.
                let end = rest.find(|c: char| c.is_whitespace() || "\"'`)]>,".contains(c)).unwrap_or(rest.len());
                out.push_str(&rest[..end].replace(['/', '\\'], std::path::MAIN_SEPARATOR_STR));
                rest = &rest[end..];
            }
            out.push_str(rest);
            *text = out;
            true
        }
        Value::Array(items) => items.iter_mut().fold(false, |changed, item| rewrite_paths(item, from, to) | changed),
        Value::Object(map) => map.values_mut().fold(false, |changed, item| rewrite_paths(item, from, to) | changed),
        _ => false,
    }
}

fn rewrite_text(text: &str, from: &str, to: &str) -> String {
    let escaped = serde_json::to_string(from).unwrap_or_default();
    let escaped = escaped.trim_matches('"');
    text.split_inclusive('\n')
        .map(|line| {
            if !line.contains(escaped) {
                return line.to_owned();
            }
            let (body, newline) = line.strip_suffix('\n').map_or((line, ""), |b| (b, "\n"));
            match serde_json::from_str::<Value>(body) {
                Ok(mut value) => {
                    if rewrite_paths(&mut value, from, to) { format!("{value}{newline}") } else { line.to_owned() }
                }
                Err(_) => line.to_owned(),
            }
        })
        .collect()
}

/// Copia la sesión a la carpeta de proyecto de `folder` dentro de `projects_dir`, con el nombre que
/// usa Claude Code (`<id>.jsonl`) y sus archivos en `<id>/`. No sobrescribe: si ya está, es un error.
pub fn import(projects_dir: &Path, file: &Path, folder: &str) -> Result<(SharedFile, PathBuf), String> {
    let shared = inspect(file)?;
    let id = shared.manifest.session_id;
    let destination = projects_dir.join(encode_project_dir(folder));
    let target = destination.join(format!("{id}.jsonl"));
    let target_dir = destination.join(id.to_string());
    if target.exists() {
        return Err("Ya tienes esta sesión en esa carpeta.".into());
    }
    std::fs::create_dir_all(&destination).map_err(|e| e.to_string())?;
    if !shared.packaged {
        std::fs::copy(file, &target).map_err(|e| e.to_string())?;
        return Ok((shared, target));
    }

    let mut archive = open_zip(file)?;
    if archive.len() > MAX_ENTRIES {
        return Err("El paquete tiene demasiados archivos.".into());
    }
    let new_dir = target_dir.to_string_lossy().into_owned();
    let rewrite = shared.manifest.source_dir.clone().filter(|from| *from != new_dir);
    let mut unpacked = 0u64;
    let mut written: Vec<PathBuf> = vec![];
    let result = (|| -> Result<(), String> {
        for index in 0..archive.len() {
            let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
            let name = entry.name().map(|n| n.into_owned()).unwrap_or_default();
            if entry.is_dir() {
                continue;
            }
            let output = if name == "session.jsonl" {
                target.clone()
            } else if let Some(relative) = name.strip_prefix("files/").and_then(safe_relative) {
                target_dir.join(relative)
            } else {
                continue;
            };
            unpacked += entry.size();
            if unpacked > MAX_UNPACKED {
                return Err("El paquete es demasiado grande para importarlo.".into());
            }
            let mut data = vec![];
            entry.by_ref().take(MAX_UNPACKED).read_to_end(&mut data).map_err(|e| e.to_string())?;
            if let (Some(from), true) = (&rewrite, is_text(&name)) {
                if let Ok(text) = std::str::from_utf8(&data) {
                    data = rewrite_text(text, from, &new_dir).into_bytes();
                }
            }
            if let Some(parent) = output.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::fs::write(&output, &data).map_err(|e| e.to_string())?;
            written.push(output);
        }
        Ok(())
    })();
    if let Err(error) = result {
        // Sin restos: lo importado a medias se quita.
        for path in written {
            let _ = std::fs::remove_file(path);
        }
        let _ = std::fs::remove_dir_all(&target_dir);
        return Err(error);
    }
    Ok((shared, target))
}

/// Carpeta propuesta para importar: la original si existe aquí; si no, una de `known` con el
/// mismo repositorio de git o, por último, con el mismo nombre.
pub fn suggest_folder(manifest: &Manifest, known: &[String]) -> Option<String> {
    if let Some(cwd) = manifest.cwd.as_deref().filter(|c| Path::new(c).is_dir()) {
        return Some(cwd.to_owned());
    }
    let existing = || known.iter().filter(|f| Path::new(f).is_dir());
    if let Some(remote) = manifest.git_remote.as_deref().map(normalize_remote) {
        if let Some(found) = existing().find(|f| git_remote(Path::new(f)).is_some_and(|r| normalize_remote(&r) == remote)) {
            return Some(found.clone());
        }
    }
    let name = manifest.cwd.as_deref().and_then(|c| c.rsplit(['/', '\\']).find(|p| !p.is_empty()))?.to_lowercase();
    existing().find(|f| Path::new(f).file_name().is_some_and(|n| n.to_string_lossy().to_lowercase() == name)).cloned()
}
