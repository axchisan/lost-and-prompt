//! Lectura y escritura de `cleanupPeriodDays` en el `settings.json` de Claude Code.

use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use crate::{Error, Result};

/// Días que Claude Code conserva las sesiones; `None` si usa el valor por defecto (30).
pub fn retention_days(settings: &Path) -> Option<u32> {
    let data = std::fs::read(settings).ok()?;
    let value: Value = serde_json::from_slice(&data).ok()?;
    value.get("cleanupPeriodDays")?.as_u64().map(|d| d as u32)
}

/// Cambia la retención conservando el resto de ajustes (y su orden). Antes guarda una copia
/// `settings.json.bak-lostandprompt-<fecha>`. Devuelve la ruta de la copia, si se hizo.
pub fn set_retention_days(settings: &Path, days: u32) -> Result<Option<PathBuf>> {
    let mut object = Map::new();
    let mut backup = None;
    if let Ok(data) = std::fs::read(settings) {
        match serde_json::from_slice::<Value>(&data)? {
            Value::Object(parsed) => object = parsed,
            _ => return Err(Error::Other("settings.json no es un objeto JSON".into())),
        }
        let stamp = chrono::Local::now().format("%Y-%m-%d");
        let name = format!("{}.bak-lostandprompt-{stamp}", file_name(settings));
        let path = settings.with_file_name(name);
        if !path.exists() {
            std::fs::copy(settings, &path)?;
            backup = Some(path);
        }
    } else if let Some(parent) = settings.parent() {
        std::fs::create_dir_all(parent)?;
    }
    object.insert("cleanupPeriodDays".into(), Value::from(days));
    let mut data = serde_json::to_vec_pretty(&Value::Object(object))?;
    data.push(b'\n');
    crate::store::write_atomic(settings, &data)?;
    Ok(backup)
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "settings.json".into())
}
