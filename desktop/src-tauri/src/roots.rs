//! Carpetas de sesiones que se leen: la de Claude Code del propio sistema y, en Windows, las de
//! cada distribución de WSL que esté en marcha.

use std::path::{Path, PathBuf};

use lap_core::paths;

#[derive(Clone, Debug)]
pub struct Root {
    /// Carpeta `projects` de Claude Code.
    pub dir: PathBuf,
    /// Distribución de WSL, si las sesiones vienen de ahí.
    pub distro: Option<String>,
    /// Carpeta personal en la que se mostrará «Inicio» (en WSL, la de Linux: `/home/ana`).
    pub home: String,
}

impl Root {
    /// Ruta de una carpeta de sesión vista desde este sistema (en WSL, `\\wsl.localhost\…`).
    pub fn native_path(&self, cwd: &str) -> PathBuf {
        match &self.distro {
            Some(distro) => PathBuf::from(format!(r"\\wsl.localhost\{distro}{}", cwd.replace('/', "\\"))),
            None => PathBuf::from(cwd),
        }
    }

    pub fn contains(&self, file: &Path) -> bool {
        file.starts_with(&self.dir)
    }
}

pub fn roots(include_wsl: bool) -> Vec<Root> {
    let home = dirs::home_dir().map(|h| h.to_string_lossy().into_owned()).unwrap_or_default();
    let mut list = vec![Root { dir: paths::projects_dir(), distro: None, home }];
    if include_wsl {
        list.extend(wsl_roots());
    }
    list
}

/// Solo las distribuciones en marcha: acceder a una apagada la arrancaría.
#[cfg(target_os = "windows")]
fn wsl_roots() -> Vec<Root> {
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
            let mut found = vec![];
            let root = base.join("root").join(".claude").join("projects");
            if root.is_dir() {
                found.push(Root { dir: root, distro: Some(distro.to_owned()), home: "/root".into() });
            }
            if let Ok(users) = std::fs::read_dir(base.join("home")) {
                for user in users.flatten() {
                    let dir = user.path().join(".claude").join("projects");
                    if dir.is_dir() {
                        let home = format!("/home/{}", user.file_name().to_string_lossy());
                        found.push(Root { dir, distro: Some(distro.to_owned()), home });
                    }
                }
            }
            found
        })
        .collect()
}

#[cfg(not(target_os = "windows"))]
fn wsl_roots() -> Vec<Root> {
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
