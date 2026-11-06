//! Cuentas de Claude Code: cada carpeta de configuración (`~/.claude`, `~/.claude-trabajo`, la de
//! `CLAUDE_CONFIG_DIR`…) guarda sus propias sesiones. Quien usa varias cuentas en el mismo equipo
//! suele cambiar de una a otra con esa variable, así que se buscan en los sitios habituales.
//!
//! Solo se lee: de los archivos del shell, únicamente los valores de `CLAUDE_CONFIG_DIR=`.

use std::path::{Path, PathBuf};

use serde::Serialize;

/// Una carpeta de configuración de Claude Code con sus sesiones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    /// Ruta de la carpeta de configuración; sirve de identificador.
    pub id: String,
    /// Nombre sacado de la carpeta (`.claude-migozz` → «Migozz»); vacío en la principal, que la
    /// interfaz llama «Principal» en el idioma de la app.
    pub name: String,
    pub config_dir: PathBuf,
    /// `~/.claude`: la que usa `claude` sin `CLAUDE_CONFIG_DIR`. Para las demás, el comando de
    /// reanudar antepone la variable.
    pub is_default: bool,
}

impl Account {
    pub fn new(config_dir: PathBuf, home: &Path) -> Self {
        let is_default = config_dir == home.join(".claude");
        let name = if is_default { String::new() } else { name_for(&config_dir) };
        Account { id: config_dir.to_string_lossy().into_owned(), name, config_dir, is_default }
    }

    pub fn projects_dir(&self) -> PathBuf {
        self.config_dir.join("projects")
    }

    pub fn settings_file(&self) -> PathBuf {
        self.config_dir.join("settings.json")
    }
}

/// `.claude-migozz` → «Migozz»; `.claude_mi-equipo` → «Mi equipo»; `claude-work` → «Work».
pub fn name_for(config_dir: &Path) -> String {
    let folder = config_dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let trimmed = folder.trim_start_matches('.');
    let rest = trimmed.strip_prefix("claude").map(|r| r.trim_start_matches(['-', '_', '.'])).unwrap_or(trimmed);
    let base = if rest.is_empty() { trimmed } else { rest };
    let words = base.replace(['-', '_', '.'], " ");
    let mut chars = words.trim().chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => folder,
    }
}

/// Archivos del shell donde se buscan valores de `CLAUDE_CONFIG_DIR=`.
pub const SHELL_FILES: &[&str] = &[".zshrc", ".zprofile", ".zshenv", ".bashrc", ".bash_profile", ".profile", ".config/fish/config.fish"];

/// Busca las cuentas:
/// 1. `~/.claude` (siempre, aunque no exista todavía);
/// 2. `$CLAUDE_CONFIG_DIR` (`env_dir`) si la app la heredó;
/// 3. carpetas `~/.claude-*` (o `~/.claude_*`) con `projects/` dentro;
/// 4. valores de `CLAUDE_CONFIG_DIR=` en los archivos del shell;
/// 5. las carpetas añadidas a mano (`extra`).
///
/// Salvo la primera, solo cuentan las que tienen carpeta `projects`. Sin repetidas.
pub fn detect(home: &Path, env_dir: Option<&Path>, extra: &[String]) -> Vec<Account> {
    let mut found: Vec<PathBuf> = vec![home.join(".claude")];
    let mut candidates: Vec<PathBuf> = vec![];
    if let Some(dir) = env_dir {
        candidates.push(dir.to_path_buf());
    }
    if let Ok(items) = std::fs::read_dir(home) {
        let mut named: Vec<PathBuf> = items
            .flatten()
            .filter(|item| {
                let name = item.file_name().to_string_lossy().into_owned();
                name.starts_with(".claude-") || name.starts_with(".claude_")
            })
            .map(|item| item.path())
            .collect();
        named.sort();
        candidates.extend(named);
    }
    for file in SHELL_FILES {
        if let Ok(text) = std::fs::read_to_string(home.join(file)) {
            candidates.extend(config_dirs_in_shell(&text, home));
        }
    }
    candidates.extend(extra.iter().map(|e| expand(e, home)));

    for dir in candidates {
        let dir = normalize(&dir);
        if found.iter().any(|f| same_dir(f, &dir)) || !dir.join("projects").is_dir() {
            continue;
        }
        found.push(dir);
    }
    found.into_iter().map(|dir| Account::new(dir, home)).collect()
}

/// Cuentas de este equipo, con lo que la app heredó del entorno.
pub fn detect_local(extra: &[String]) -> Vec<Account> {
    let home = dirs::home_dir().unwrap_or_default();
    let env = std::env::var_os("CLAUDE_CONFIG_DIR").filter(|d| !d.is_empty()).map(PathBuf::from);
    detect(&home, env.as_deref(), extra)
}

/// Valores de `CLAUDE_CONFIG_DIR=` (o `set -x CLAUDE_CONFIG_DIR …` en fish) en un archivo del
/// shell, con `~`, `$HOME` y `${HOME}` resueltos. Se ignoran los comentarios y los valores que
/// dependen de otras variables.
pub fn config_dirs_in_shell(text: &str, home: &Path) -> Vec<PathBuf> {
    const KEY: &str = "CLAUDE_CONFIG_DIR";
    let mut result = vec![];
    for line in text.lines() {
        let code = line.trim_start();
        if code.starts_with('#') {
            continue;
        }
        let mut rest = code;
        while let Some(position) = rest.find(KEY) {
            let before = rest[..position].chars().last();
            let after = &rest[position + KEY.len()..];
            rest = after;
            // Que sea la variable y no parte de otro nombre (`MY_CLAUDE_CONFIG_DIR`).
            if before.is_some_and(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$' || c == '{') {
                continue;
            }
            let value = if let Some(v) = after.strip_prefix('=') {
                v
            } else if code.contains("set ") && after.starts_with([' ', '\t']) {
                after.trim_start() // fish: set -gx CLAUDE_CONFIG_DIR valor
            } else {
                continue;
            };
            if let Some(dir) = shell_value(value, home) {
                result.push(dir);
            }
        }
    }
    result
}

/// Primer valor de shell (entre comillas o hasta un espacio o `;`).
fn shell_value(value: &str, home: &Path) -> Option<PathBuf> {
    let raw: String = match value.chars().next()? {
        quote @ ('"' | '\'') => value[1..].split(quote).next()?.to_owned(),
        _ => value.split(|c: char| c.is_whitespace() || c == ';' || c == ')' || c == '`').next()?.to_owned(),
    };
    let resolved = raw.replace("${HOME}", "$HOME");
    let resolved = if let Some(rest) = resolved.strip_prefix("$HOME") {
        format!("{}{rest}", home.to_string_lossy())
    } else if let Some(rest) = resolved.strip_prefix('~') {
        format!("{}{rest}", home.to_string_lossy())
    } else {
        resolved
    };
    if resolved.is_empty() || resolved.contains('$') || !Path::new(&resolved).is_absolute() {
        return None;
    }
    Some(PathBuf::from(resolved))
}

fn expand(path: &str, home: &Path) -> PathBuf {
    match path.strip_prefix('~') {
        Some(rest) => PathBuf::from(format!("{}{rest}", home.to_string_lossy())),
        None => PathBuf::from(path),
    }
}

/// Quita la barra final para comparar y mostrar.
fn normalize(path: &Path) -> PathBuf {
    let text = path.to_string_lossy();
    let trimmed = text.trim_end_matches(['/', '\\']);
    if trimmed.is_empty() { path.to_path_buf() } else { PathBuf::from(trimmed) }
}

/// Misma carpeta, aunque se escriba distinto (enlaces simbólicos, mayúsculas en macOS).
fn same_dir(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(x), Ok(y)) => x == y,
        _ => false,
    }
}

/// Comando de Claude Code con la cuenta puesta: `CLAUDE_CONFIG_DIR='…' claude …` para las cuentas
/// que no son la principal, en sintaxis de shell POSIX (zsh, bash, fish ≥ 3.1).
pub fn with_account_unix(command: &str, config_dir: Option<&str>) -> String {
    match config_dir {
        Some(dir) => format!("CLAUDE_CONFIG_DIR='{}' {command}", dir.replace('\'', r"'\''")),
        None => command.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nombres() {
        assert_eq!(name_for(Path::new("/Users/ana/.claude-migozz")), "Migozz");
        assert_eq!(name_for(Path::new("/Users/ana/.claude_mi-equipo")), "Mi equipo");
        assert_eq!(name_for(Path::new("/srv/claude-work")), "Work");
        assert_eq!(name_for(Path::new("/srv/configuracion")), "Configuracion");
        assert_eq!(name_for(Path::new("/srv/.claude")), "Claude");
    }

    #[test]
    fn lee_la_variable_del_shell() {
        let home = Path::new("/Users/ana");
        let zshrc = r#"
# CLAUDE_CONFIG_DIR="$HOME/.claude-comentada" no cuenta
export CLAUDE_CONFIG_DIR=~/.claude-uno
claude() {
  if [[ $PWD == */Migozz* ]]; then
    TOKEN="$(security find-generic-password -w)" CLAUDE_CONFIG_DIR="$HOME/.claude-migozz" command claude "$@"
  fi
}
alias cw='CLAUDE_CONFIG_DIR=${HOME}/.claude-work claude'
MY_CLAUDE_CONFIG_DIR=/otra
CLAUDE_CONFIG_DIR="$OTRA/x"
CLAUDE_CONFIG_DIR=/opt/claude-equipo; claude
"#;
        let dirs = config_dirs_in_shell(zshrc, home);
        assert_eq!(
            dirs,
            vec![
                PathBuf::from("/Users/ana/.claude-uno"),
                PathBuf::from("/Users/ana/.claude-migozz"),
                PathBuf::from("/Users/ana/.claude-work"),
                PathBuf::from("/opt/claude-equipo"),
            ]
        );
        let fish = "set -gx CLAUDE_CONFIG_DIR $HOME/.claude-pez\n";
        assert_eq!(config_dirs_in_shell(fish, home), vec![PathBuf::from("/Users/ana/.claude-pez")]);
    }

    #[test]
    fn detecta_las_cuentas() {
        let home = tempfile::tempdir().unwrap();
        let h = home.path();
        std::fs::create_dir_all(h.join(".claude/projects")).unwrap();
        std::fs::create_dir_all(h.join(".claude-migozz/projects")).unwrap();
        std::fs::create_dir_all(h.join(".claude-sin-proyectos")).unwrap();
        std::fs::create_dir_all(h.join("trabajo/claude/projects")).unwrap();
        std::fs::create_dir_all(h.join("manual/projects")).unwrap();
        std::fs::create_dir_all(h.join("entorno/projects")).unwrap();
        std::fs::write(
            h.join(".zshrc"),
            format!("export CLAUDE_CONFIG_DIR=\"{}/trabajo/claude\"\nCLAUDE_CONFIG_DIR=$HOME/.claude-migozz/ claude\n", h.display()),
        )
        .unwrap();

        let env = h.join("entorno");
        let accounts = detect(h, Some(&env), &[h.join("manual").to_string_lossy().into_owned(), h.join("no-existe").to_string_lossy().into_owned()]);
        let names: Vec<(&str, bool)> = accounts.iter().map(|a| (a.name.as_str(), a.is_default)).collect();
        assert_eq!(names, vec![("", true), ("Entorno", false), ("Migozz", false), ("Claude", false), ("Manual", false)]);
        assert_eq!(accounts[2].projects_dir(), h.join(".claude-migozz/projects"));
    }

    #[test]
    fn la_principal_aparece_aunque_no_exista() {
        let home = tempfile::tempdir().unwrap();
        let accounts = detect(home.path(), None, &[]);
        assert_eq!(accounts.len(), 1);
        assert!(accounts[0].is_default);
    }

    #[test]
    fn comando_con_cuenta() {
        assert_eq!(with_account_unix("claude --resume x", None), "claude --resume x");
        assert_eq!(
            with_account_unix("claude --resume x", Some("/Users/o'neil/.claude-b")),
            r"CLAUDE_CONFIG_DIR='/Users/o'\''neil/.claude-b' claude --resume x"
        );
    }
}
