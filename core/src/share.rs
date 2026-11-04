//! Compartir sesiones: el archivo `.jsonl` se exporta tal cual y otra persona lo importa en su
//! equipo, en la carpeta de su proyecto, para retomarla con `claude --resume`.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

use serde_json::Value;
use uuid::Uuid;

use crate::store::encode_project_dir;

/// Lo que se sabe de un archivo de sesión antes de importarlo.
#[derive(Debug, Clone, PartialEq)]
pub struct SessionFile {
    pub id: Uuid,
    /// Carpeta donde se abrió en el equipo original.
    pub cwd: Option<String>,
}

/// Lee el id y la carpeta de un archivo de sesión de Claude Code. Falla si no lo es.
pub fn inspect(path: &Path) -> Result<SessionFile, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("No se pudo abrir el archivo: {e}"))?;
    let mut id = None;
    let mut cwd = None;
    // Las primeras líneas bastan: todas las de mensajes llevan sessionId y cwd.
    for line in BufReader::new(file).lines().take(400).map_while(Result::ok) {
        let Ok(object) = serde_json::from_str::<Value>(&line) else { continue };
        if id.is_none() {
            id = object.get("sessionId").and_then(Value::as_str).and_then(|s| Uuid::parse_str(s).ok());
        }
        if cwd.is_none() {
            cwd = object.get("cwd").and_then(Value::as_str).map(str::to_owned);
        }
        if id.is_some() && cwd.is_some() {
            break;
        }
    }
    let id = id.ok_or("El archivo no es una sesión de Claude Code.")?;
    Ok(SessionFile { id, cwd })
}

/// Copia la sesión a la carpeta de proyecto de `folder` dentro de `projects_dir`, con el nombre que
/// usa Claude Code (`<id>.jsonl`). No sobrescribe: si ya está, es un error.
pub fn import(projects_dir: &Path, file: &Path, folder: &str) -> Result<(SessionFile, PathBuf), String> {
    let session = inspect(file)?;
    let destination = projects_dir.join(encode_project_dir(folder));
    let target = destination.join(format!("{}.jsonl", session.id));
    if target.exists() {
        return Err("Ya tienes esta sesión en esa carpeta.".into());
    }
    std::fs::create_dir_all(&destination).map_err(|e| e.to_string())?;
    std::fs::copy(file, &target).map_err(|e| e.to_string())?;
    Ok((session, target))
}
