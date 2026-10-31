use std::path::PathBuf;

/// Carpeta de configuración de Claude Code: `$CLAUDE_CONFIG_DIR` o `~/.claude`
/// (`%USERPROFILE%\.claude` en Windows).
pub fn claude_home() -> PathBuf {
    if let Some(dir) = std::env::var_os("CLAUDE_CONFIG_DIR").filter(|d| !d.is_empty()) {
        return PathBuf::from(dir);
    }
    dirs::home_dir().unwrap_or_default().join(".claude")
}

pub fn projects_dir() -> PathBuf {
    claude_home().join("projects")
}

pub fn settings_file() -> PathBuf {
    claude_home().join("settings.json")
}

/// Carpeta de datos propios de Lost & Prompt (caché, índice y organización).
///
/// - Windows: `%APPDATA%\LostAndPrompt`
/// - Linux: `$XDG_DATA_HOME/lost-and-prompt` (o `~/.local/share/lost-and-prompt`)
/// - macOS: `~/Library/Application Support/LostAndPrompt-Tauri`. Solo se usa al desarrollar;
///   va aparte de la app nativa (`LostAndPrompt`), que guarda sus datos en otro formato.
pub fn app_data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(std::env::temp_dir);
    if cfg!(target_os = "linux") {
        base.join("lost-and-prompt")
    } else if cfg!(target_os = "macos") {
        base.join("LostAndPrompt-Tauri")
    } else {
        base.join("LostAndPrompt")
    }
}
