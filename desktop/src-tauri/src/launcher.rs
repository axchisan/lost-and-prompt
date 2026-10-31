//! Abre una sesión de Claude Code en la terminal elegida, en su carpeta original.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
pub struct TerminalInfo {
    pub id: &'static str,
    pub name: &'static str,
}

/// Terminales disponibles en este equipo, la recomendada primero.
pub fn available() -> Vec<TerminalInfo> {
    let mut list = vec![];
    if warp_installed() {
        list.push(TerminalInfo { id: "warp", name: "Warp" });
    }
    if cfg!(target_os = "windows") {
        if in_path("wt.exe") {
            list.insert(0, TerminalInfo { id: "windows-terminal", name: "Windows Terminal" });
        }
        list.push(TerminalInfo { id: "powershell", name: "PowerShell" });
    } else if cfg!(target_os = "macos") {
        list.push(TerminalInfo { id: "terminal", name: "Terminal" });
    } else {
        for (id, name, binary) in LINUX_TERMINALS {
            if in_path(binary) {
                list.push(TerminalInfo { id, name });
            }
        }
    }
    list
}

const LINUX_TERMINALS: &[(&str, &str, &str)] = &[
    ("gnome-terminal", "GNOME Terminal", "gnome-terminal"),
    ("ptyxis", "Ptyxis", "ptyxis"),
    ("konsole", "Konsole", "konsole"),
    ("kitty", "Kitty", "kitty"),
    ("wezterm", "WezTerm", "wezterm"),
    ("alacritty", "Alacritty", "alacritty"),
    ("xterm", "XTerm", "xterm"),
];

pub fn resume(terminal: &str, cwd: &str, command: &str, title: &str) -> Result<(), String> {
    let result = match terminal {
        "warp" => open_in_warp(cwd, command, title),
        #[cfg(target_os = "windows")]
        "windows-terminal" => spawn(Command::new("wt.exe").args(["-d", cwd, "powershell", "-NoExit", "-Command", command])),
        #[cfg(target_os = "windows")]
        "powershell" => spawn(Command::new("cmd").args(["/c", "start", "", "powershell", "-NoExit", "-Command", command]).current_dir(cwd)),
        #[cfg(target_os = "macos")]
        "terminal" => open_script_in_terminal(cwd, command),
        other => linux(other, cwd, command),
    };
    result.map_err(|e| format!("No se pudo abrir la terminal: {e}"))
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn linux(terminal: &str, cwd: &str, command: &str) -> std::io::Result<()> {
    // La terminal queda abierta al salir de Claude Code.
    let shell = format!("{command}; exec \"${{SHELL:-bash}}\"");
    let mut cmd = match terminal {
        "gnome-terminal" => {
            let mut c = Command::new("gnome-terminal");
            c.arg(format!("--working-directory={cwd}")).args(["--", "bash", "-lc", &shell]);
            c
        }
        "ptyxis" => {
            let mut c = Command::new("ptyxis");
            c.args(["--new-window", "--working-directory", cwd, "--", "bash", "-lc", &shell]);
            c
        }
        "konsole" => {
            let mut c = Command::new("konsole");
            c.args(["--workdir", cwd, "-e", "bash", "-lc", &shell]);
            c
        }
        "kitty" => {
            let mut c = Command::new("kitty");
            c.args(["--directory", cwd, "bash", "-lc", &shell]);
            c
        }
        "wezterm" => {
            let mut c = Command::new("wezterm");
            c.args(["start", "--cwd", cwd, "--", "bash", "-lc", &shell]);
            c
        }
        "alacritty" => {
            let mut c = Command::new("alacritty");
            c.args(["--working-directory", cwd, "-e", "bash", "-lc", &shell]);
            c
        }
        _ => {
            let mut c = Command::new("xterm");
            c.args(["-e", "bash", "-lc", &format!("cd {} && {shell}", quote(cwd))]);
            c
        }
    };
    spawn(cmd.current_dir(cwd))
}

/// Warp ejecuta comandos al abrir una Tab Config (`tab_configs/*.toml`).
fn open_in_warp(cwd: &str, command: &str, title: &str) -> std::io::Result<()> {
    let folder = warp_tab_configs_dir().ok_or_else(|| std::io::Error::other("Warp no está instalado"))?;
    std::fs::create_dir_all(&folder)?;
    let config = format!(
        "# Generado por Lost & Prompt: se reescribe en cada reanudación.\nname = \"Lost & Prompt\"\ntitle = {}\n\n[[panes]]\nid = \"main\"\ntype = \"terminal\"\ndirectory = {}\ncommands = [{}]\n",
        toml(title),
        toml(cwd),
        toml(command)
    );
    std::fs::write(folder.join("lost_and_prompt.toml"), config)?;
    tauri_plugin_opener::open_url("warp://tab_config/lost_and_prompt", None::<&str>).map_err(std::io::Error::other)
}

fn warp_tab_configs_dir() -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        Some(dirs::config_dir()?.join("warp").join("Warp").join("data").join("tab_configs"))
    } else if cfg!(target_os = "macos") {
        Some(dirs::home_dir()?.join(".warp").join("tab_configs"))
    } else {
        Some(dirs::data_dir()?.join("warp-terminal").join("tab_configs"))
    }
}

fn warp_installed() -> bool {
    if cfg!(target_os = "macos") {
        Path::new("/Applications/Warp.app").exists()
    } else if cfg!(target_os = "windows") {
        dirs::data_local_dir().is_some_and(|d| d.join("Programs").join("Warp").exists()) || in_path("warp.exe")
    } else {
        in_path("warp-terminal")
    }
}

#[cfg(target_os = "macos")]
fn open_script_in_terminal(cwd: &str, command: &str) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let script = std::env::temp_dir().join(format!("lost-and-prompt-{}.command", std::process::id()));
    std::fs::write(&script, format!("#!/bin/zsh -l\ncd {} && {command}\n", quote(cwd)))?;
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755))?;
    spawn(Command::new("open").args(["-a", "Terminal"]).arg(script))
}

fn spawn(command: &mut Command) -> std::io::Result<()> {
    command.spawn().map(|_| ())
}

fn in_path(binary: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|paths| std::env::split_paths(&paths).any(|dir| dir.join(binary).is_file()))
}

fn toml(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}
