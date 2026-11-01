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
    /// Sesiones archivadas: no salen en Recientes, carpetas ni colecciones.
    pub archived: BTreeSet<Uuid>,
    /// Carpetas («entornos») de cada colección: sus sesiones y las de sus subcarpetas, también las
    /// futuras, entran en la colección.
    pub collection_folders: BTreeMap<String, Vec<String>>,
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

    /// Archiva o recupera la sesión. Devuelve si quedó archivada.
    pub fn toggle_archive(&mut self, id: Uuid) -> bool {
        if !self.archived.remove(&id) {
            self.archived.insert(id);
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
        self.collection_folders.remove(id);
    }

    /// Cambia el nombre y el color de una colección.
    pub fn update_collection(&mut self, id: &str, name: &str, tint: Tint) {
        if let Some(collection) = self.collections.iter_mut().find(|c| c.id == id) {
            collection.name = name.trim().to_owned();
            collection.tint = tint;
        }
    }

    /// Añade o quita una carpeta de la colección. Devuelve si quedó dentro.
    pub fn toggle_folder(&mut self, collection: &str, folder: &str) -> bool {
        let folders = self.collection_folders.entry(collection.to_owned()).or_default();
        let inside = if let Some(position) = folders.iter().position(|f| f == folder) {
            folders.remove(position);
            false
        } else {
            folders.push(folder.to_owned());
            true
        };
        if folders.is_empty() {
            self.collection_folders.remove(collection);
        }
        inside
    }

    /// Colecciones que incluyen la carpeta `cwd` o una carpeta que la contiene.
    pub fn folder_collections_of(&self, cwd: &str) -> Vec<&str> {
        self.collection_folders
            .iter()
            .filter(|(_, folders)| folders.iter().any(|folder| is_within(cwd, folder)))
            .map(|(c, _)| c.as_str())
            .collect()
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

/// `true` si `path` es `folder` o está dentro (con `/` o `\`, para rutas de Windows y WSL).
fn is_within(path: &str, folder: &str) -> bool {
    let folder = folder.trim_end_matches(['/', '\\']);
    path == folder || path.strip_prefix(folder).is_some_and(|rest| rest.starts_with(['/', '\\']))
}
