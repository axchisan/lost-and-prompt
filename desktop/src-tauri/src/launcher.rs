//! Abre una sesión de Claude Code en la terminal elegida, en su carpeta original.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
pub struct TerminalInfo {
    pub id: &'static str,
    pub name: &'static str,
    /// `false` si no se detectó; se puede elegir igual (por si está en una ruta poco común).
    pub installed: bool,
}

struct Terminal {
    id: &'static str,
    name: &'static str,
    detect: fn() -> bool,
}

/// Terminales que la app sabe abrir en este sistema, las instaladas primero.
pub fn available() -> Vec<TerminalInfo> {
    let mut list: Vec<TerminalInfo> = terminals()
        .iter()
        .map(|t| TerminalInfo { id: t.id, name: t.name, installed: (t.detect)() })
        .collect();
    list.sort_by_key(|t| !t.installed);
    list.push(TerminalInfo { id: "custom", name: "", installed: true });
    list
}

#[cfg(target_os = "windows")]
fn terminals() -> &'static [Terminal] {
    &[
        Terminal { id: "windows-terminal", name: "Windows Terminal", detect: || in_path("wt.exe") },
        Terminal { id: "warp", name: "Warp", detect: warp_installed },
        Terminal { id: "pwsh", name: "PowerShell 7", detect: || in_path("pwsh.exe") },
        Terminal { id: "powershell", name: "Windows PowerShell", detect: || true },
        Terminal { id: "cmd", name: "Símbolo del sistema (cmd)", detect: || true },
        Terminal { id: "git-bash", name: "Git Bash", detect: || git_bash().is_some() },
        Terminal { id: "wezterm", name: "WezTerm", detect: || in_path("wezterm.exe") },
        Terminal { id: "alacritty", name: "Alacritty", detect: || in_path("alacritty.exe") },
    ]
}

#[cfg(target_os = "macos")]
fn terminals() -> &'static [Terminal] {
    &[
        Terminal { id: "warp", name: "Warp", detect: warp_installed },
        Terminal { id: "terminal", name: "Terminal", detect: || true },
    ]
}

#[cfg(all(unix, not(target_os = "macos")))]
fn terminals() -> &'static [Terminal] {
    &[
        Terminal { id: "warp", name: "Warp", detect: warp_installed },
        Terminal { id: "gnome-terminal", name: "GNOME Terminal", detect: || in_path("gnome-terminal") },
        Terminal { id: "ptyxis", name: "Ptyxis", detect: || in_path("ptyxis") },
        Terminal { id: "konsole", name: "Konsole", detect: || in_path("konsole") },
        Terminal { id: "kitty", name: "Kitty", detect: || in_path("kitty") },
        Terminal { id: "wezterm", name: "WezTerm", detect: || in_path("wezterm") },
        Terminal { id: "alacritty", name: "Alacritty", detect: || in_path("alacritty") },
        Terminal { id: "ghostty", name: "Ghostty", detect: || in_path("ghostty") },
        Terminal { id: "xterm", name: "XTerm", detect: || in_path("xterm") },
    ]
}

/// `custom` usa la plantilla del usuario: `{cwd}` es la carpeta (entre comillas) y `{command}`
/// el comando de Claude Code (`claude --resume <id> …`).
pub fn resume(terminal: &str, cwd: &str, command: &str, title: &str, custom_template: Option<&str>) -> Result<(), String> {
    let result = match terminal {
        "warp" => open_in_warp(cwd, command, title),
        "custom" => run_template(custom_template.unwrap_or_default(), cwd, command),
        other => open_native(other, cwd, command),
    };
    result.map_err(|e| format!("No se pudo abrir la terminal: {e}"))
}

/// Sesión de Claude Code dentro de WSL: se abre la distribución en la carpeta de Linux.
pub fn resume_wsl(distro: &str, cwd: &str, command: &str) -> Result<(), String> {
    let shell = format!("{command}; exec \"${{SHELL:-bash}}\"");
    let args = ["-d", distro, "--cd", cwd, "--", "bash", "-lc", shell.as_str()];
    let result = if cfg!(target_os = "windows") && in_path("wt.exe") {
        spawn(Command::new("wt.exe").arg("wsl.exe").args(args))
    } else if cfg!(target_os = "windows") {
        let mut all = vec!["/c", "start", "", "wsl.exe"];
        all.extend_from_slice(&args);
        spawn(hidden(&mut Command::new("cmd").args(all)))
    } else {
        Err(std::io::Error::other("WSL solo existe en Windows"))
    };
    result.map_err(|e| format!("No se pudo abrir WSL: {e}"))
}

fn run_template(template: &str, cwd: &str, command: &str) -> std::io::Result<()> {
    if template.trim().is_empty() {
        return Err(std::io::Error::other("la plantilla de terminal personalizada está vacía"));
    }
    let line = template.replace("{cwd}", &quote(cwd)).replace("{command}", command);
    if cfg!(target_os = "windows") {
        spawn(hidden(Command::new("cmd").args(["/c", &line]).current_dir(cwd)))
    } else {
        spawn(Command::new("/bin/sh").args(["-c", &line]).current_dir(cwd))
    }
}

#[cfg(target_os = "windows")]
fn open_native(terminal: &str, cwd: &str, command: &str) -> std::io::Result<()> {
    let start = |args: &[&str]| -> std::io::Result<()> {
        let mut all = vec!["/c", "start", ""];
        all.extend_from_slice(args);
        spawn(hidden(Command::new("cmd").args(all).current_dir(cwd)))
    };
    match terminal {
        "windows-terminal" => spawn(Command::new("wt.exe").args(["-d", cwd, "powershell", "-NoExit", "-Command", command])),
        "pwsh" => start(&["pwsh", "-NoExit", "-Command", command]),
        "cmd" => start(&["cmd", "/k", command]),
        "git-bash" => {
            let exe = git_bash().ok_or_else(|| std::io::Error::other("Git Bash no está instalado"))?;
            spawn(Command::new(exe).arg(format!("--cd={cwd}")).args(["-c", &format!("{command}; exec bash")]))
        }
        "wezterm" => spawn(Command::new("wezterm.exe").args(["start", "--cwd", cwd, "--", "powershell", "-NoExit", "-Command", command])),
        "alacritty" => spawn(Command::new("alacritty.exe").args(["--working-directory", cwd, "-e", "powershell", "-NoExit", "-Command", command])),
        _ => start(&["powershell", "-NoExit", "-Command", command]),
    }
}

#[cfg(target_os = "macos")]
fn open_native(_terminal: &str, cwd: &str, command: &str) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let script = std::env::temp_dir().join(format!("lost-and-prompt-{}.command", std::process::id()));
    std::fs::write(&script, format!("#!/bin/zsh -l\ncd {} && {command}\n", quote(cwd)))?;
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755))?;
    spawn(Command::new("open").args(["-a", "Terminal"]).arg(script))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_native(terminal: &str, cwd: &str, command: &str) -> std::io::Result<()> {
    // La terminal queda abierta al salir de Claude Code.
    let shell = format!("{command}; exec \"${{SHELL:-bash}}\"");
    let bash = ["bash", "-lc", shell.as_str()];
    let mut cmd = match terminal {
        "gnome-terminal" => {
            let mut c = Command::new("gnome-terminal");
            c.arg(format!("--working-directory={cwd}")).arg("--").args(bash);
            c
        }
        "ptyxis" => {
            let mut c = Command::new("ptyxis");
            c.args(["--new-window", "--working-directory", cwd, "--"]).args(bash);
            c
        }
        "konsole" => {
            let mut c = Command::new("konsole");
            c.args(["--workdir", cwd, "-e"]).args(bash);
            c
        }
        "kitty" => {
            let mut c = Command::new("kitty");
            c.args(["--directory", cwd]).args(bash);
            c
        }
        "wezterm" => {
            let mut c = Command::new("wezterm");
            c.args(["start", "--cwd", cwd, "--"]).args(bash);
            c
        }
        "alacritty" => {
            let mut c = Command::new("alacritty");
            c.args(["--working-directory", cwd, "-e"]).args(bash);
            c
        }
        "ghostty" => {
            let mut c = Command::new("ghostty");
            c.arg(format!("--working-directory={cwd}")).arg("-e").args(bash);
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

// MARK: Editores

#[derive(Serialize)]
pub struct EditorInfo {
    pub id: &'static str,
    pub name: &'static str,
}

struct Editor {
    id: &'static str,
    name: &'static str,
    /// Comandos de línea de órdenes que instala el editor.
    cli: &'static [&'static str],
    /// Rutas de instalación en Windows, relativas a `%LOCALAPPDATA%` o `%ProgramFiles%`.
    windows: &'static [&'static str],
    /// Abre carpetas de WSL con `--remote wsl+<distro>` (los derivados de VS Code).
    remote_wsl: bool,
}

const EDITORS: &[Editor] = &[
    Editor { id: "vscode", name: "Visual Studio Code", cli: &["code"], windows: &[r"Programs\Microsoft VS Code\Code.exe", r"Microsoft VS Code\Code.exe"], remote_wsl: true },
    Editor { id: "cursor", name: "Cursor", cli: &["cursor"], windows: &[r"Programs\cursor\Cursor.exe"], remote_wsl: true },
    Editor { id: "windsurf", name: "Windsurf", cli: &["windsurf"], windows: &[r"Programs\Windsurf\Windsurf.exe"], remote_wsl: true },
    Editor { id: "zed", name: "Zed", cli: &["zed", "zeditor", "zedit"], windows: &[r"Programs\Zed\zed.exe"], remote_wsl: false },
    Editor { id: "sublime", name: "Sublime Text", cli: &["subl"], windows: &[r"Sublime Text\subl.exe", r"Sublime Text 3\subl.exe"], remote_wsl: false },
    Editor { id: "intellij", name: "IntelliJ IDEA", cli: &["idea", "intellij-idea-ultimate", "intellij-idea-community"], windows: &[], remote_wsl: false },
    Editor { id: "webstorm", name: "WebStorm", cli: &["webstorm"], windows: &[], remote_wsl: false },
    Editor { id: "pycharm", name: "PyCharm", cli: &["pycharm", "pycharm-professional", "pycharm-community"], windows: &[], remote_wsl: false },
];

enum EditorLaunch {
    Exe(PathBuf),
    /// Comando del `PATH`; en Windows suele ser un `.cmd`, que hay que abrir con `cmd /c`.
    Cli(&'static str),
}

fn locate(editor: &Editor) -> Option<EditorLaunch> {
    if cfg!(target_os = "windows") {
        let bases = ["LOCALAPPDATA", "ProgramFiles", "ProgramW6432"].iter().filter_map(|v| std::env::var_os(v)).map(PathBuf::from);
        for base in bases {
            if let Some(exe) = editor.windows.iter().map(|rel| base.join(rel)).find(|p| p.exists()) {
                return Some(EditorLaunch::Exe(exe));
            }
        }
        return editor
            .cli
            .iter()
            .find(|name| in_path(&format!("{name}.cmd")) || in_path(&format!("{name}.exe")))
            .map(|name| EditorLaunch::Cli(name));
    }
    editor.cli.iter().find(|name| in_path(name)).map(|name| EditorLaunch::Cli(name))
}

/// Editores conocidos instalados en este equipo.
pub fn editors() -> Vec<EditorInfo> {
    EDITORS.iter().filter(|e| locate(e).is_some()).map(|e| EditorInfo { id: e.id, name: e.name }).collect()
}

/// Abre la carpeta en el editor. Las de WSL se abren por `\\wsl.localhost` salvo en los editores
/// con modo remoto, que trabajan dentro de la distribución.
pub fn open_in_editor(id: &str, cwd: &str, distro: Option<&str>) -> Result<(), String> {
    let editor = EDITORS.iter().find(|e| e.id == id).ok_or("Editor desconocido")?;
    let launch = locate(editor).ok_or_else(|| format!("{} no está instalado.", editor.name))?;
    let args: Vec<String> = match distro {
        Some(distro) if editor.remote_wsl => vec!["--remote".into(), format!("wsl+{distro}"), cwd.into()],
        Some(distro) => vec![crate::roots::wsl_path(distro, cwd).to_string_lossy().into_owned()],
        None => vec![cwd.into()],
    };
    let result = match launch {
        EditorLaunch::Exe(exe) => spawn(hidden(Command::new(exe).args(&args))),
        EditorLaunch::Cli(name) if cfg!(target_os = "windows") => spawn(hidden(Command::new("cmd").arg("/c").arg(name).args(&args))),
        EditorLaunch::Cli(name) => spawn(Command::new(name).args(&args)),
    };
    result.map_err(|e| format!("No se pudo abrir {}: {e}", editor.name))
}

// MARK: Warp

/// Warp ejecuta comandos al abrir una Tab Config (`tab_configs/*.toml`).
fn open_in_warp(cwd: &str, command: &str, title: &str) -> std::io::Result<()> {
    let folder = warp_tab_configs_dir().ok_or_else(|| std::io::Error::other("no se encontró la carpeta de Warp"))?;
    std::fs::create_dir_all(&folder)?;
    let config = format!(
        "# Generado por Lost & Prompt: se reescribe en cada reanudación.\nname = \"Lost & Prompt\"\ntitle = {}\n\n[[panes]]\nid = \"main\"\ntype = \"terminal\"\ndirectory = {}\ncommands = [{}]\n",
        toml(title),
        toml(cwd),
        toml(command)
    );
    std::fs::write(folder.join("lost_and_prompt.toml"), config)?;
    tauri_plugin_opener::open_url("warp://tab_config/lost_and_prompt", None::<&str>)
        .map_err(|e| std::io::Error::other(format!("Warp no respondió ({e}). ¿Está instalado?")))
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

/// Warp se detecta por sus rutas de instalación habituales, por el `PATH` o porque tiene
/// registrado el protocolo `warp://`.
fn warp_installed() -> bool {
    if cfg!(target_os = "macos") {
        return Path::new("/Applications/Warp.app").exists()
            || dirs::home_dir().is_some_and(|h| h.join("Applications/Warp.app").exists());
    }
    if cfg!(target_os = "windows") {
        let mut candidates: Vec<PathBuf> = vec![];
        if let Some(local) = dirs::data_local_dir() {
            candidates.push(local.join("Programs").join("Warp").join("warp.exe"));
            candidates.push(local.join("Warp").join("warp.exe"));
        }
        for var in ["ProgramFiles", "ProgramW6432"] {
            if let Some(dir) = std::env::var_os(var) {
                candidates.push(PathBuf::from(dir).join("Warp").join("warp.exe"));
            }
        }
        return candidates.iter().any(|p| p.exists()) || in_path("warp.exe") || windows_protocol_registered("warp");
    }
    in_path("warp-terminal") || Path::new("/opt/warpdotdev/warp-terminal").exists()
}

#[cfg(target_os = "windows")]
fn windows_protocol_registered(scheme: &str) -> bool {
    [format!(r"HKCU\Software\Classes\{scheme}"), format!(r"HKLM\Software\Classes\{scheme}")].iter().any(|key| {
        hidden(Command::new("reg").args(["query", key])).output().is_ok_and(|o| o.status.success())
    })
}

#[cfg(not(target_os = "windows"))]
fn windows_protocol_registered(_scheme: &str) -> bool {
    false
}

#[cfg(target_os = "windows")]
fn git_bash() -> Option<PathBuf> {
    ["ProgramFiles", "ProgramW6432", "LOCALAPPDATA"]
        .iter()
        .filter_map(|var| std::env::var_os(var))
        .flat_map(|dir| {
            let dir = PathBuf::from(dir);
            [dir.join("Git").join("git-bash.exe"), dir.join("Programs").join("Git").join("git-bash.exe")]
        })
        .find(|p| p.exists())
}

// MARK: Ayudantes

/// Sin ventana de consola de paso en Windows.
fn hidden(command: &mut Command) -> &mut Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    command
}

fn spawn(command: &mut Command) -> std::io::Result<()> {
    command.spawn().map(|_| ())
}

/// Los alias de aplicaciones de Windows (`wt.exe`) son puntos de reanálisis vacíos:
/// basta con que existan.
fn in_path(binary: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|paths| std::env::split_paths(&paths).any(|dir| dir.join(binary).exists()))
}

fn toml(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn quote(value: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("\"{value}\"")
    } else {
        format!("'{}'", value.replace('\'', r"'\''"))
    }
}
