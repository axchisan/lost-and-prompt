//! Índice de texto completo de las conversaciones (SQLite FTS5).
//!
//! Es una caché: se puede borrar y se reconstruye sola. Solo guarda tus mensajes y las
//! respuestas de Claude, no los resultados de herramientas.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::model::{Role, SessionSummary};
use crate::{store, Result};

#[derive(Debug, Clone, PartialEq)]
pub struct SearchHit {
    pub session_id: Uuid,
    /// Fragmento con la coincidencia entre `\u{1}` y `\u{2}`.
    pub snippet: String,
}

pub struct SearchIndex {
    db: Connection,
}

impl SearchIndex {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let db = Connection::open(path)?;
        db.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS files (session TEXT PRIMARY KEY, modified REAL NOT NULL, size INTEGER NOT NULL);
             CREATE VIRTUAL TABLE IF NOT EXISTS messages USING fts5(
                 session UNINDEXED, role UNINDEXED, text,
                 tokenize = 'unicode61 remove_diacritics 2'
             );",
        )?;
        Ok(Self { db })
    }

    /// Indexa las sesiones nuevas o cambiadas y quita las que ya no existen.
    /// `progress(hechas, total)` se llama antes de cada sesión y al terminar. Devuelve cuántas indexó.
    pub fn update(&mut self, summaries: &[SessionSummary], mut progress: impl FnMut(usize, usize)) -> Result<usize> {
        let known = self.indexed_files()?;
        let current: HashSet<String> = summaries.iter().map(|s| s.id.to_string()).collect();
        for stale in known.keys().filter(|k| !current.contains(*k)) {
            self.delete(stale)?;
        }
        let pending: Vec<&SessionSummary> = summaries
            .iter()
            .filter(|s| match known.get(&s.id.to_string()) {
                None => s.user_messages > 0,
                Some(&(modified, size)) => modified != timestamp(s) || size != s.size as i64,
            })
            .collect();

        for (done, summary) in pending.iter().enumerate() {
            progress(done, pending.len());
            let messages = store::messages(Path::new(&summary.path));
            let id = summary.id.to_string();
            let tx = self.db.transaction()?;
            tx.execute("DELETE FROM messages WHERE session = ?1", [&id])?;
            tx.execute(
                "INSERT OR REPLACE INTO files (session, modified, size) VALUES (?1, ?2, ?3)",
                params![id, timestamp(summary), summary.size as i64],
            )?;
            {
                let mut insert = tx.prepare("INSERT INTO messages (session, role, text) VALUES (?1, ?2, ?3)")?;
                for message in messages.iter().filter(|m| !m.text.is_empty()) {
                    let role = if message.role == Role::User { "user" } else { "assistant" };
                    insert.execute(params![id, role, message.text])?;
                }
            }
            tx.commit()?;
        }
        progress(pending.len(), pending.len());
        Ok(pending.len())
    }

    /// Busca palabras (como prefijos) y devuelve como mucho una coincidencia por sesión.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchHit>> {
        let Some(expression) = match_expression(query) else { return Ok(vec![]) };
        let mut statement = self.db.prepare(
            "SELECT session, snippet(messages, 2, char(1), char(2), '…', 14)
             FROM messages WHERE messages MATCH ?1 ORDER BY rank LIMIT 400",
        )?;
        let rows = statement.query_map([expression], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
        let mut hits = vec![];
        let mut seen = HashSet::new();
        for row in rows {
            let (session, snippet) = row?;
            let Ok(id) = Uuid::parse_str(&session) else { continue };
            if !seen.insert(id) {
                continue;
            }
            hits.push(SearchHit { session_id: id, snippet: snippet.replace('\n', " ") });
            if hits.len() >= limit {
                break;
            }
        }
        Ok(hits)
    }

    fn indexed_files(&self) -> Result<HashMap<String, (f64, i64)>> {
        let mut statement = self.db.prepare("SELECT session, modified, size FROM files")?;
        let rows = statement.query_map([], |row| Ok((row.get(0)?, (row.get(1)?, row.get(2)?))))?;
        Ok(rows.collect::<std::result::Result<_, _>>()?)
    }

    fn delete(&self, session: &str) -> Result<()> {
        self.db.execute("DELETE FROM messages WHERE session = ?1", [session])?;
        self.db.execute("DELETE FROM files WHERE session = ?1", [session])?;
        Ok(())
    }
}

/// `silk song` → `"silk"* "song"*`: cada palabra como prefijo, sin sintaxis FTS del usuario.
pub fn match_expression(query: &str) -> Option<String> {
    let words: Vec<String> = query
        .split_whitespace()
        .map(|w| w.replace('"', ""))
        .filter(|w| !w.is_empty())
        .map(|w| format!("\"{w}\"*"))
        .collect();
    (!words.is_empty()).then(|| words.join(" "))
}

fn timestamp(summary: &SessionSummary) -> f64 {
    summary.modified.timestamp_micros() as f64 / 1_000_000.0
}
