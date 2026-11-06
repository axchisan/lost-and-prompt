//! Carpetas de sesiones que se leen: las de cada cuenta de Claude Code del propio sistema y, en
//! Windows, las de cada distribución de WSL que esté en marcha.

use std::path::{Path, PathBuf};

use lap_core::accounts::{self, Account};

#[derive(Clone, Debug)]
pub struct Root {
    /// Carpeta `projects` de Claude Code.
    pub dir: PathBuf,
    /// Distribución de WSL, si las sesiones vienen de ahí.
    pub distro: Option<String>,
    /// Carpeta personal en la que se mostrará «Inicio» (en WSL, la de Linux: `/home/ana`).
    pub home: String,
    /// Cuenta de Claude Code (su carpeta de configuración). Las sesiones de `~/.claude` de WSL
    /// cuentan como de la cuenta principal.
    pub account: String,
    /// Valor de `CLAUDE_CONFIG_DIR` para reanudar, visto desde donde corre Claude Code (en WSL, la
    /// ruta de Linux). `None` en la carpeta por defecto (`~/.claude`).
    pub config_env: Option<String>,
}

impl Root {
    /// Ruta de una carpeta de sesión vista desde este sistema (en WSL, `\\wsl.localhost\…`).
    pub fn native_path(&self, cwd: &str) -> PathBuf {
        match &self.distro {
            Some(distro) => wsl_path(distro, cwd),
            None => PathBuf::from(cwd),
        }
    }

    pub fn contains(&self, file: &Path) -> bool {
        file.starts_with(&self.dir)
    }
}

/// Una raíz por cada cuenta visible (`accounts` ya sin las ocultas) y, si se pide, las de WSL.
pub fn roots(include_wsl: bool, accounts: &[Account], default_account: &str) -> Vec<Root> {
    let home = dirs::home_dir().map(|h| h.to_string_lossy().into_owned()).unwrap_or_default();
    let mut list: Vec<Root> = accounts
        .iter()
        .map(|a| Root {
            dir: a.projects_dir(),
            distro: None,
            home: home.clone(),
            account: a.id.clone(),
            config_env: (!a.is_default).then(|| a.id.clone()),
        })
        .collect();
    if include_wsl {
        list.extend(wsl_roots(default_account));
    }
    list
}

/// Carpetas `.claude` y `.claude-*` con `projects/` dentro de una carpeta personal de WSL.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn wsl_accounts(distro: &str, home_native: &Path, home_linux: &str, default_account: &str) -> Vec<Root> {
    let Ok(items) = std::fs::read_dir(home_native) else { return vec![] };
    let mut found: Vec<Root> = items
        .flatten()
        .filter_map(|item| {
            let name = item.file_name().to_string_lossy().into_owned();
            let is_config = name == ".claude" || name.starts_with(".claude-") || name.starts_with(".claude_");
            let dir = item.path().join("projects");
            if !is_config || !dir.is_dir() {
                return None;
            }
            let is_default = name == ".claude";
            Some(Root {
                dir,
                distro: Some(distro.to_owned()),
                home: home_linux.to_owned(),
                account: if is_default { default_account.to_owned() } else { item.path().to_string_lossy().into_owned() },
                config_env: (!is_default).then(|| format!("{}/{name}", home_linux.trim_end_matches('/'))),
            })
        })
        .collect();
    found.sort_by(|a, b| a.dir.cmp(&b.dir));
    found
}

/// Nombre de una cuenta de WSL que no es la principal: «Trabajo (Ubuntu)».
pub fn wsl_account_name(root: &Root) -> String {
    let folder = root.dir.parent().map(accounts::name_for).unwrap_or_default();
    match &root.distro {
        Some(distro) => format!("{folder} ({distro})"),
        None => folder,
    }
}

/// Solo las distribuciones en marcha: acceder a una apagada la arrancaría.
#[cfg(target_os = "windows")]
fn wsl_roots(default_account: &str) -> Vec<Root> {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("wsl.exe")
        .args(["--list", "--running", "--quiet"])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output();
    let Ok(output) = output else { return vec![] };
    decode(&output.stdout)
        .lines()
        .map(|line| line.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}' || c == '\0'))
        .filter(|distro| !distro.is_empty())
        .flat_map(|distro| {
            let base = PathBuf::from(format!(r"\\wsl.localhost\{distro}"));
            let mut found = wsl_accounts(distro, &base.join("root"), "/root", default_account);
            if let Ok(users) = std::fs::read_dir(base.join("home")) {
                for user in users.flatten() {
                    let home = format!("/home/{}", user.file_name().to_string_lossy());
                    found.extend(wsl_accounts(distro, &user.path(), &home, default_account));
                }
            }
            found
        })
        .collect()
}

#[cfg(not(target_os = "windows"))]
fn wsl_roots(_default_account: &str) -> Vec<Root> {
    vec![]
}

/// `wsl.exe` escribe en UTF-16 salvo que `WSL_UTF8=1`.
#[cfg(target_os = "windows")]
fn decode(bytes: &[u8]) -> String {
    if bytes.len() >= 2 && bytes.iter().skip(1).step_by(2).filter(|b| **b == 0).count() * 2 >= bytes.len() / 2 {
        let units: Vec<u16> = bytes.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
        String::from_utf16_lossy(&units)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

/// Ruta de Windows (`\\wsl.localhost\<distro>\…`) de una carpeta de Linux dentro de WSL.
pub fn wsl_path(distro: &str, cwd: &str) -> PathBuf {
    PathBuf::from(format!(r"\\wsl.localhost\{distro}{}", cwd.replace('/', "\\")))
}
