use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Resumen de un archivo de sesión (`<proyecto>/<id>.jsonl`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: Uuid,
    pub path: String,
    pub size: u64,
    /// Fecha de modificación del archivo: la última actividad de la sesión.
    pub modified: DateTime<Utc>,
    pub ai_title: Option<String>,
    /// Directorio donde se abrió la sesión: el que corresponde a la carpeta del archivo.
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub user_messages: u32,
    pub assistant_messages: u32,
    pub cost_usd: Option<f64>,
    pub model: Option<String>,
    pub first_prompt: Option<String>,
    pub last_reply: Option<String>,
}

impl SessionSummary {
    /// Título para mostrar: el generado por Claude Code o, si no hay, el inicio del primer mensaje.
    pub fn display_title(&self) -> Option<String> {
        self.ai_title
            .clone()
            .or_else(|| self.first_prompt.as_ref().map(|p| p.chars().take(60).collect()))
    }

    /// Comando para reanudar la sesión en su carpeta.
    pub fn resume_command(&self, extra_arguments: &str) -> String {
        let extra = extra_arguments.trim();
        let base = format!("claude --resume {}", self.id);
        if extra.is_empty() { base } else { format!("{base} {extra}") }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

/// Mensaje de la conversación, sin ruido técnico (solo texto humano y respuestas de Claude).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub role: Role,
    pub date: Option<DateTime<Utc>>,
    pub text: String,
    /// Herramientas que Claude usó después de este mensaje.
    pub tool_count: u32,
    /// Razonamiento de Claude (bloque `thinking`); la app lo muestra solo si se pide.
    #[serde(default)]
    pub thinking: bool,
}

/// `claude-opus-5-5` → «Opus 5.5».
pub fn model_name(id: Option<&str>) -> String {
    let Some(id) = id else { return "—".into() };
    let Some(rest) = id.strip_prefix("claude-") else { return id.into() };
    let mut parts = rest.split('-');
    let Some(family) = parts.next() else { return id.into() };
    let version: Vec<&str> = parts
        .take_while(|p| !p.is_empty() && p.len() <= 2 && p.chars().all(|c| c.is_ascii_digit()))
        .collect();
    let mut name: String = family[..1].to_uppercase() + &family[1..];
    if !version.is_empty() {
        name.push(' ');
        name.push_str(&version.join("."));
    }
    name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nombres_de_modelo() {
        assert_eq!(model_name(Some("claude-opus-5-5")), "Opus 5.5");
        assert_eq!(model_name(Some("claude-haiku-5-5-20261001")), "Haiku 5.5");
        assert_eq!(model_name(Some("claude-fable-5-1")), "Fable 5.1");
        assert_eq!(model_name(Some("gpt-x")), "gpt-x");
        assert_eq!(model_name(None), "—");
    }
}
