//! Reparar carpetas movidas: cuando una carpeta de trabajo se mueve o se renombra (en el Finder,
//! el Explorador…), Claude Code deja de encontrar sus sesiones, su memoria y sus ajustes, porque
//! todo cuelga de la ruta exacta. Esto los pasa a la ruta nueva, en todas sus subcarpetas:
//!
//! - `projects/<carpeta-codificada>/` se renombra (o se fusiona si ya existe);
//! - el `cwd` de cada línea de sus conversaciones (y de los subagentes);
//! - el `project` de `history.jsonl`;
//! - la clave de cada carpeta en `projects` de `.claude.json` (confianza, MCP, herramientas).
//!
//! Mismas salvaguardas que al eliminar (ver `docs/decisiones.md`, D17): plan previo, nunca con una
//! sesión abierta, copia de todo lo que se reescribe y escrituras atómicas. No mueve la carpeta de
//! trabajo en el disco: eso ya lo hizo el usuario.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::cleanup::open_sessions_with_cwd;
use crate::store::encode_project_dir;
use crate::{Error, Result};

/// Una carpeta de proyecto de Claude Code que cambia de ruta.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMove {
    pub from_cwd: String,
    pub to_cwd: String,
    pub from_dir: PathBuf,
    pub to_dir: PathBuf,
    pub sessions: usize,
    /// Ya existe la carpeta nueva (se usó Claude Code en la ruta nueva): se fusionan.
    pub merge: bool,
    pub has_memory: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairPlan {
    pub config_dir: PathBuf,
    pub claude_json: PathBuf,
    pub from: String,
    pub to: String,
    pub folders: Vec<FolderMove>,
    /// Conversaciones (y subagentes) cuyo `cwd` se reescribe.
    pub files: Vec<PathBuf>,
    pub history_lines: usize,
    /// Claves de `projects` en `.claude.json` que pasan a la ruta nueva.
    pub settings_keys: Vec<String>,
    /// Sesiones abiertas ahora mismo en alguna de esas carpetas: bloquean la operación.
    pub in_use: Vec<Uuid>,
}

impl RepairPlan {
    pub fn is_empty(&self) -> bool {
        self.folders.is_empty() && self.history_lines == 0 && self.settings_keys.is_empty()
    }
}

/// `.claude.json` de una cuenta: `~/.claude.json` para `~/.claude` y `<carpeta>/.claude.json` para
/// las demás (las de `CLAUDE_CONFIG_DIR`).
pub fn claude_json_for(config_dir: &Path, home: &Path) -> PathBuf {
    if config_dir == home.join(".claude") { home.join(".claude.json") } else { config_dir.join(".claude.json") }
}

/// Separador de la ruta (`\` en Windows).
fn separator(path: &str) -> char {
    if path.contains('\\') && !path.contains('/') { '\\' } else { '/' }
}

/// `path` es `folder` o está dentro; devuelve el resto (vacío o empezando por el separador).
fn rest_of<'a>(path: &'a str, folder: &str, sep: char) -> Option<&'a str> {
    let folder = folder.trim_end_matches(sep);
    let rest = path.strip_prefix(folder)?;
    (rest.is_empty() || rest.starts_with(sep)).then_some(rest)
}

/// Calcula qué cambiaría al pasar `from` (y sus subcarpetas) a `to`, sin tocar nada.
pub fn plan_repair(config_dir: &Path, claude_json: &Path, from: &str, to: &str) -> RepairPlan {
    let sep = separator(from);
    let from = from.trim_end_matches(sep).to_owned();
    let to = to.trim_end_matches(sep).to_owned();
    let projects = config_dir.join("projects");
    let settings = read_json(claude_json);
    let setting_keys: Vec<String> = settings
        .as_ref()
        .and_then(|v| v.get("projects")?.as_object().map(|o| o.keys().cloned().collect()))
        .unwrap_or_default();

    let mut plan = RepairPlan {
        config_dir: config_dir.to_path_buf(),
        claude_json: claude_json.to_path_buf(),
        from: from.clone(),
        to: to.clone(),
        folders: vec![],
        files: vec![],
        history_lines: 0,
        settings_keys: setting_keys.iter().filter(|k| rest_of(k, &from, sep).is_some()).cloned().collect(),
        in_use: vec![],
    };
    if from == to {
        plan.settings_keys.clear();
        return plan;
    }

    let encoded = encode_project_dir(&from);
    if let Ok(entries) = std::fs::read_dir(&projects) {
        let mut folders: Vec<PathBuf> = entries.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect();
        folders.sort();
        for dir in folders {
            let name = dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            // `encode` conserva los prefijos: las subcarpetas empiezan por el nombre codificado.
            if name != encoded && !name.starts_with(&format!("{encoded}-")) {
                continue;
            }
            let sessions = jsonl_files(&dir);
            // La ruta real de la carpeta: la de sus conversaciones o, si solo tiene memoria, la de
            // los ajustes de `.claude.json` que se codifica igual.
            let cwd = sessions
                .iter()
                .find_map(|f| first_cwd(f).filter(|c| encode_project_dir(c) == name))
                .or_else(|| setting_keys.iter().find(|k| encode_project_dir(k) == name).cloned())
                .or_else(|| (name == encoded).then(|| from.clone()));
            let Some(cwd) = cwd else { continue };
            let Some(rest) = rest_of(&cwd, &from, sep) else { continue };
            let to_cwd = format!("{to}{rest}");
            let to_dir = projects.join(encode_project_dir(&to_cwd));
            plan.files.extend(sessions.iter().cloned());
            plan.files.extend(subagent_files(&dir));
            plan.folders.push(FolderMove {
                merge: to_dir.exists() && to_dir != dir,
                has_memory: dir.join("memory").is_dir(),
                sessions: sessions.len(),
                from_cwd: cwd,
                to_cwd,
                from_dir: dir,
                to_dir,
            });
        }
    }

    let history = config_dir.join("history.jsonl");
    if let Ok(text) = std::fs::read_to_string(&history) {
        plan.history_lines = replace_key(&text, "project", &from, &to, sep).1;
    }
    let mut in_use: Vec<Uuid> = open_sessions_with_cwd(config_dir)
        .into_iter()
        .filter(|(_, cwd)| cwd.as_deref().is_some_and(|c| rest_of(c, &from, sep).is_some()))
        .map(|(id, _)| id)
        .collect();
    // Las abiertas sin carpeta conocida cuentan si su conversación está en una de las carpetas.
    for (id, cwd) in open_sessions_with_cwd(config_dir) {
        if cwd.is_none() && plan.files.iter().any(|f| f.file_stem().is_some_and(|s| s.to_string_lossy() == id.to_string())) {
            in_use.push(id);
        }
    }
    in_use.sort();
    in_use.dedup();
    plan.in_use = in_use;
    plan
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairOutcome {
    /// Copia de todo lo que se reescribió.
    pub backup_dir: PathBuf,
    pub folders: usize,
    pub lines: usize,
}

/// Aplica el plan. Antes vuelve a comprobar que no haya sesiones abiertas y copia todo lo que
/// reescribe en `backups_dir/reparar-<fecha>/`.
pub fn execute_repair(plan: &RepairPlan, backups_dir: &Path) -> Result<RepairOutcome> {
    let fresh = plan_repair(&plan.config_dir, &plan.claude_json, &plan.from, &plan.to);
    if !fresh.in_use.is_empty() {
        return Err(Error::Other("Hay una sesión abierta en esa carpeta. Ciérrala en la terminal primero.".into()));
    }
    let sep = separator(&fresh.from);
    let stamp = chrono::Local::now().format("%Y-%m-%d-%H%M%S");
    let backup_dir = backups_dir.join(format!("reparar-{stamp}"));
    std::fs::create_dir_all(&backup_dir)?;

    // 1. Copias.
    let projects = fresh.config_dir.join("projects");
    for file in &fresh.files {
        let relative = file.strip_prefix(&projects).unwrap_or(file);
        let target = backup_dir.join("projects").join(relative);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(file, target)?;
    }
    let history = fresh.config_dir.join("history.jsonl");
    if history.exists() {
        std::fs::copy(&history, backup_dir.join("history.jsonl"))?;
    }
    if fresh.claude_json.exists() {
        std::fs::copy(&fresh.claude_json, backup_dir.join(".claude.json"))?;
    }

    // 2. Conversaciones y carpetas de proyecto.
    let mut lines = 0;
    for file in &fresh.files {
        let text = std::fs::read_to_string(file)?;
        let (changed, count) = replace_key(&text, "cwd", &fresh.from, &fresh.to, sep);
        if count > 0 {
            write_atomic(file, &changed)?;
            lines += count;
        }
    }
    for folder in &fresh.folders {
        if folder.to_dir == folder.from_dir {
            continue;
        }
        if folder.to_dir.exists() {
            merge_dir(&folder.from_dir, &folder.to_dir)?;
        } else {
            std::fs::rename(&folder.from_dir, &folder.to_dir)?;
        }
    }

    // 3. Historial de lo escrito.
    if let Ok(text) = std::fs::read_to_string(&history) {
        let (changed, count) = replace_key(&text, "project", &fresh.from, &fresh.to, sep);
        if count > 0 {
            write_atomic(&history, &changed)?;
        }
    }

    // 4. Ajustes por carpeta: solo `projects` de `.claude.json`.
    if !fresh.settings_keys.is_empty() {
        if let Some(Value::Object(mut root)) = read_json(&fresh.claude_json) {
            if let Some(Value::Object(projects)) = root.get_mut("projects") {
                let mut moved = Map::new();
                for (key, value) in std::mem::take(projects) {
                    match rest_of(&key, &fresh.from, sep) {
                        Some(rest) => {
                            moved.insert(format!("{}{rest}", fresh.to), value);
                        }
                        None => {
                            projects.insert(key, value);
                        }
                    }
                }
                // Si la ruta nueva ya tenía ajustes, se quedan los suyos.
                for (key, value) in moved {
                    projects.entry(key).or_insert(value);
                }
            }
            let mut data = serde_json::to_string_pretty(&Value::Object(root))?;
            data.push('\n');
            write_atomic(&fresh.claude_json, &data)?;
        }
    }

    Ok(RepairOutcome { backup_dir, folders: fresh.folders.len(), lines })
}

/// Cambia `"<clave>":"<from>…"` por `"<clave>":"<to>…"` cuando el valor es `from` o está dentro.
/// Trabaja sobre el texto para no alterar nada más de cada línea. Devuelve el texto y cuántos
/// valores cambió.
pub fn replace_key(text: &str, key: &str, from: &str, to: &str, sep: char) -> (String, usize) {
    let escape = |s: &str| {
        let quoted = serde_json::to_string(s).unwrap_or_default();
        quoted[1..quoted.len() - 1].to_owned()
    };
    let needle = format!("\"{key}\":\"{}", escape(from));
    let replacement = format!("\"{key}\":\"{}", escape(to));
    let sep_escaped = escape(&sep.to_string());
    let mut result = String::with_capacity(text.len());
    let mut count = 0;
    let mut rest = text;
    while let Some(position) = rest.find(&needle) {
        let after = &rest[position + needle.len()..];
        result.push_str(&rest[..position]);
        if after.starts_with('"') || after.starts_with(&sep_escaped) {
            result.push_str(&replacement);
            count += 1;
        } else {
            result.push_str(&needle);
        }
        rest = after;
    }
    result.push_str(rest);
    (result, count)
}

/// Pasa el contenido de `from` a `to`, carpeta por carpeta. Si un archivo ya existe en el destino,
/// el de origen se guarda al lado con otro nombre; nunca se pisa nada.
fn merge_dir(from: &Path, to: &Path) -> Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)?.flatten() {
        let source = entry.path();
        let target = to.join(entry.file_name());
        if !target.exists() {
            std::fs::rename(&source, &target)?;
        } else if source.is_dir() && target.is_dir() {
            merge_dir(&source, &target)?;
        } else {
            let name = format!("{}.movida-{}", entry.file_name().to_string_lossy(), chrono::Local::now().format("%Y%m%d%H%M%S"));
            std::fs::rename(&source, to.join(name))?;
        }
    }
    std::fs::remove_dir(from).or_else(|_| std::fs::remove_dir_all(from))?;
    Ok(())
}

fn jsonl_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else { return vec![] };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "jsonl") && p.file_stem().and_then(|s| s.to_str()).is_some_and(|s| Uuid::parse_str(s).is_ok()))
        .collect();
    files.sort();
    files
}

/// `.jsonl` de los subagentes (`<id>/subagents/…`), que también llevan `cwd`.
fn subagent_files(dir: &Path) -> Vec<PathBuf> {
    let mut found = vec![];
    let Ok(entries) = std::fs::read_dir(dir) else { return found };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() || path.file_name().is_some_and(|n| n == "memory") {
            continue;
        }
        let mut stack = vec![path];
        while let Some(folder) = stack.pop() {
            for item in std::fs::read_dir(&folder).into_iter().flatten().flatten() {
                let p = item.path();
                if p.is_dir() {
                    stack.push(p);
                } else if p.extension().is_some_and(|x| x == "jsonl") {
                    found.push(p);
                }
            }
        }
    }
    found.sort();
    found
}

/// Primer `cwd` de una conversación (sin leer el archivo entero).
fn first_cwd(file: &Path) -> Option<String> {
    use std::io::{BufRead, BufReader};
    let reader = BufReader::new(std::fs::File::open(file).ok()?);
    for line in reader.lines().take(200).map_while(std::result::Result::ok) {
        if !line.contains("\"cwd\":") {
            continue;
        }
        if let Some(cwd) = serde_json::from_str::<Value>(&line).ok().and_then(|v| v.get("cwd")?.as_str().map(str::to_owned)) {
            return Some(cwd);
        }
    }
    None
}

fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_slice(&std::fs::read(path).ok()?).ok()
}

fn write_atomic(path: &Path, text: &str) -> Result<()> {
    let tmp = path.with_extension("lostandprompt-tmp");
    std::fs::write(&tmp, text)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const B: &str = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const C: &str = "33333333-cccc-4ccc-8ccc-cccccccccccc";

    fn write(path: &Path, text: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, text).unwrap();
    }

    fn line(id: &str, cwd: &str) -> String {
        format!("{{\"type\":\"user\",\"cwd\":\"{cwd}\",\"sessionId\":\"{id}\",\"message\":{{\"content\":\"lee {cwd}/README\"}}}}\n")
    }

    /// `~/Dev/web` (con una subcarpeta `api`) se movió a `~/Proyectos/web`; `~/Dev/web-old` no.
    fn fake() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join(".claude");
        let projects = config.join("projects");
        write(&projects.join("-Users-ana-Dev-web").join(format!("{A}.jsonl")), &line(A, "/Users/ana/Dev/web"));
        write(&projects.join("-Users-ana-Dev-web").join(A).join("subagents/agent.jsonl"), &line(A, "/Users/ana/Dev/web"));
        write(&projects.join("-Users-ana-Dev-web/memory/MEMORY.md"), "- nota");
        write(&projects.join("-Users-ana-Dev-web-api").join(format!("{B}.jsonl")), &line(B, "/Users/ana/Dev/web/api"));
        write(&projects.join("-Users-ana-Dev-web-old").join(format!("{C}.jsonl")), &line(C, "/Users/ana/Dev/web-old"));
        write(
            &config.join("history.jsonl"),
            &format!(
                "{{\"display\":\"a\",\"project\":\"/Users/ana/Dev/web\",\"sessionId\":\"{A}\"}}\n{{\"display\":\"c\",\"project\":\"/Users/ana/Dev/web-old\",\"sessionId\":\"{C}\"}}\n"
            ),
        );
        let claude_json = dir.path().join(".claude.json");
        write(
            &claude_json,
            r#"{"userID":"x","projects":{"/Users/ana/Dev/web":{"hasTrustDialogAccepted":true},"/Users/ana/Dev/web/api":{"mcpServers":{}},"/Users/ana/Dev/web-old":{}}}"#,
        );
        (dir, config, claude_json)
    }

    #[test]
    fn reemplaza_solo_la_clave_y_la_carpeta_exacta() {
        let text = "{\"cwd\":\"/a/web\",\"x\":\"/a/web\"}\n{\"cwd\":\"/a/web/api\"}\n{\"cwd\":\"/a/web-old\"}\n";
        let (out, count) = replace_key(text, "cwd", "/a/web", "/b/web", '/');
        assert_eq!(count, 2);
        assert_eq!(out, "{\"cwd\":\"/b/web\",\"x\":\"/a/web\"}\n{\"cwd\":\"/b/web/api\"}\n{\"cwd\":\"/a/web-old\"}\n");
        let (win, n) = replace_key(r#"{"cwd":"C:\\Dev\\web\\api"}"#, "cwd", r"C:\Dev\web", r"D:\web", '\\');
        assert_eq!((win.as_str(), n), (r#"{"cwd":"D:\\web\\api"}"#, 1));
    }

    #[test]
    fn planea_la_carpeta_y_sus_subcarpetas() {
        let (_dir, config, claude_json) = fake();
        let plan = plan_repair(&config, &claude_json, "/Users/ana/Dev/web", "/Users/ana/Proyectos/web");
        let moves: Vec<(&str, &str)> = plan.folders.iter().map(|f| (f.from_cwd.as_str(), f.to_cwd.as_str())).collect();
        assert_eq!(moves, vec![("/Users/ana/Dev/web", "/Users/ana/Proyectos/web"), ("/Users/ana/Dev/web/api", "/Users/ana/Proyectos/web/api")]);
        assert_eq!(plan.files.len(), 3);
        assert_eq!(plan.history_lines, 1);
        assert_eq!(plan.settings_keys, vec!["/Users/ana/Dev/web", "/Users/ana/Dev/web/api"]);
        assert!(plan.folders[0].has_memory);
    }

    #[test]
    fn repara_todo_con_copia() {
        let (dir, config, claude_json) = fake();
        let plan = plan_repair(&config, &claude_json, "/Users/ana/Dev/web", "/Users/ana/Proyectos/web");
        let outcome = execute_repair(&plan, &dir.path().join("copias")).unwrap();
        let projects = config.join("projects");
        assert!(!projects.join("-Users-ana-Dev-web").exists());
        let moved = projects.join("-Users-ana-Proyectos-web");
        assert!(moved.join("memory/MEMORY.md").exists());
        let text = std::fs::read_to_string(moved.join(format!("{A}.jsonl"))).unwrap();
        // El cwd cambia; lo demás de la línea (el texto del mensaje) queda igual.
        assert_eq!(text, "{\"type\":\"user\",\"cwd\":\"/Users/ana/Proyectos/web\",\"sessionId\":\"11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa\",\"message\":{\"content\":\"lee /Users/ana/Dev/web/README\"}}\n");
        assert!(std::fs::read_to_string(moved.join(A).join("subagents/agent.jsonl")).unwrap().contains("Proyectos/web"));
        assert!(projects.join("-Users-ana-Proyectos-web-api").join(format!("{B}.jsonl")).exists());
        assert!(projects.join("-Users-ana-Dev-web-old").exists());
        let history = std::fs::read_to_string(config.join("history.jsonl")).unwrap();
        assert!(history.contains("\"project\":\"/Users/ana/Proyectos/web\"") && history.contains("\"project\":\"/Users/ana/Dev/web-old\""));
        let settings: Value = serde_json::from_slice(&std::fs::read(&claude_json).unwrap()).unwrap();
        let keys: Vec<&String> = settings["projects"].as_object().unwrap().keys().collect();
        assert_eq!(keys, vec!["/Users/ana/Dev/web-old", "/Users/ana/Proyectos/web", "/Users/ana/Proyectos/web/api"]);
        assert_eq!(settings["userID"], "x");
        assert_eq!(settings["projects"]["/Users/ana/Proyectos/web"]["hasTrustDialogAccepted"], true);
        assert!(outcome.backup_dir.join(".claude.json").exists());
        assert!(outcome.backup_dir.join("projects/-Users-ana-Dev-web").join(format!("{A}.jsonl")).exists());
        assert_eq!(outcome.lines, 3);
    }

    #[test]
    fn fusiona_si_la_ruta_nueva_ya_se_uso() {
        let (dir, config, claude_json) = fake();
        let projects = config.join("projects");
        write(&projects.join("-Users-ana-Proyectos-web").join(format!("{C}.jsonl")), &line(C, "/Users/ana/Proyectos/web"));
        write(&projects.join("-Users-ana-Proyectos-web/memory/MEMORY.md"), "- nueva");
        let plan = plan_repair(&config, &claude_json, "/Users/ana/Dev/web", "/Users/ana/Proyectos/web");
        assert!(plan.folders[0].merge);
        execute_repair(&plan, &dir.path().join("copias")).unwrap();
        let moved = projects.join("-Users-ana-Proyectos-web");
        assert!(moved.join(format!("{A}.jsonl")).exists() && moved.join(format!("{C}.jsonl")).exists());
        assert_eq!(std::fs::read_to_string(moved.join("memory/MEMORY.md")).unwrap(), "- nueva");
        let kept = std::fs::read_dir(moved.join("memory")).unwrap().count();
        assert_eq!(kept, 2, "la memoria vieja queda al lado con otro nombre");
    }

    #[test]
    fn no_repara_con_una_sesion_abierta() {
        let (dir, config, claude_json) = fake();
        let pid = std::process::id();
        write(&config.join(format!("sessions/{pid}.json")), &format!("{{\"pid\":{pid},\"sessionId\":\"{B}\",\"cwd\":\"/Users/ana/Dev/web/api\"}}"));
        let plan = plan_repair(&config, &claude_json, "/Users/ana/Dev/web", "/Users/ana/Proyectos/web");
        assert_eq!(plan.in_use, vec![Uuid::parse_str(B).unwrap()]);
        assert!(execute_repair(&plan, &dir.path().join("copias")).is_err());
        assert!(config.join("projects/-Users-ana-Dev-web").exists());
    }

    #[test]
    fn json_de_cada_cuenta() {
        let home = Path::new("/Users/ana");
        assert_eq!(claude_json_for(&home.join(".claude"), home), home.join(".claude.json"));
        assert_eq!(claude_json_for(&home.join(".claude-x"), home), home.join(".claude-x/.claude.json"));
    }
}
