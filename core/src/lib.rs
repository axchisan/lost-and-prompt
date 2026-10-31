//! Núcleo multiplataforma de Lost & Prompt.
//!
//! Lee las sesiones de Claude Code (`~/.claude/projects`), las indexa para buscar en las
//! conversaciones, guarda la organización propia del usuario y ajusta la retención del
//! historial. Es el equivalente en Rust de `LostAndPrompt/Core` (Swift) y debe comportarse igual.

pub mod model;
pub mod organization;
pub mod paths;
pub mod search;
pub mod settings;
pub mod store;

pub use model::{Message, Role, SessionSummary};
pub use organization::{Collection, Organization, Tint};
pub use search::{SearchHit, SearchIndex};
pub use store::{encode_project_dir, messages, scan, summarize};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("E/S: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("SQLite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
