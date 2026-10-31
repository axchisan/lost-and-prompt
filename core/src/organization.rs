//! Organización propia del usuario: nunca se escribe en los archivos de Claude Code.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::Result;

/// Colores de etiqueta, los mismos que en la versión de Mac (los de Finder).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tint {
    Red,
    Orange,
    Yellow,
    Green,
    Teal,
    Blue,
    Indigo,
    Purple,
    Gray,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub tint: Tint,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Organization {
    pub favorites: BTreeSet<Uuid>,
    pub custom_titles: BTreeMap<Uuid, String>,
    pub notes: BTreeMap<Uuid, String>,
    pub collections: Vec<Collection>,
    /// Colección → sesiones que contiene.
    pub memberships: BTreeMap<String, Vec<Uuid>>,
    /// Sesiones reanudadas en otra carpeta porque la original ya no existía: sesión → carpeta nueva.
    /// Vale hasta que Claude Code escriba en la sesión con la carpeta nueva.
    pub relocations: BTreeMap<Uuid, String>,
}

impl Organization {
    pub fn load(path: &Path) -> Self {
        std::fs::read(path).ok().and_then(|data| serde_json::from_slice(&data).ok()).unwrap_or_default()
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        crate::store::write_atomic(path, &serde_json::to_vec_pretty(self)?)?;
        Ok(())
    }

    pub fn toggle_favorite(&mut self, id: Uuid) -> bool {
        if !self.favorites.remove(&id) {
            self.favorites.insert(id);
            return true;
        }
        false
    }

    /// Nombre propio; vacío o igual al título original lo quita.
    pub fn rename(&mut self, id: Uuid, title: &str, original: &str) {
        let title = title.trim();
        if title.is_empty() || title == original {
            self.custom_titles.remove(&id);
        } else {
            self.custom_titles.insert(id, title.to_owned());
        }
    }

    pub fn set_note(&mut self, id: Uuid, text: &str) {
        let text = text.trim();
        if text.is_empty() {
            self.notes.remove(&id);
        } else {
            self.notes.insert(id, text.to_owned());
        }
    }

    pub fn create_collection(&mut self, name: &str, tint: Tint) -> Collection {
        let collection = Collection { id: Uuid::new_v4().to_string(), name: name.trim().to_owned(), tint };
        self.collections.push(collection.clone());
        collection
    }

    pub fn delete_collection(&mut self, id: &str) {
        self.collections.retain(|c| c.id != id);
        self.memberships.remove(id);
    }

    /// Añade o quita la sesión de la colección. Devuelve si quedó dentro.
    pub fn toggle_membership(&mut self, session: Uuid, collection: &str) -> bool {
        let members = self.memberships.entry(collection.to_owned()).or_default();
        if let Some(position) = members.iter().position(|m| *m == session) {
            members.remove(position);
            false
        } else {
            members.push(session);
            true
        }
    }

    pub fn collections_of(&self, session: Uuid) -> Vec<&str> {
        self.memberships.iter().filter(|(_, m)| m.contains(&session)).map(|(c, _)| c.as_str()).collect()
    }
}
