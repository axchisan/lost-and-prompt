//! Compara el núcleo Rust con la caché que escribe la app de Swift en macOS y mide la velocidad.
//! Uso: cargo run --release -p lost-and-prompt-core --example parity
//! Solo lee; no escribe nada fuera de una carpeta temporal.

use std::collections::HashMap;
use std::time::Instant;

use lap_core::{paths, scan, SearchIndex};
use serde_json::Value;

fn main() {
    let projects = paths::projects_dir();
    let start = Instant::now();
    let sessions = scan(&projects, None);
    let scan_time = start.elapsed();
    let total_mb: f64 = sessions.iter().map(|s| s.size as f64).sum::<f64>() / 1e6;
    println!("Escaneo: {} sesiones, {:.0} MB en {:.2?}", sessions.len(), total_mb, scan_time);

    let swift_cache = dirs::data_dir().unwrap().join("LostAndPrompt/index-cache.json");
    let swift: HashMap<String, Value> = serde_json::from_slice(&std::fs::read(&swift_cache).expect("caché de Swift")).unwrap();

    let (mut compared, mut differences) = (0, 0);
    for s in &sessions {
        let Some(other) = swift.get(&s.path) else { continue };
        if other["size"].as_u64() != Some(s.size) {
            continue; // el archivo cambió desde que lo leyó la app de Swift
        }
        compared += 1;
        let checks = [
            ("título", Value::from(s.ai_title.clone()), other["aiTitle"].clone()),
            ("carpeta", Value::from(s.cwd.clone()), other["cwd"].clone()),
            ("rama", Value::from(s.git_branch.clone()), other["gitBranch"].clone()),
            ("mensajes tuyos", Value::from(s.user_messages), other["userMessages"].clone()),
            ("mensajes de Claude", Value::from(s.assistant_messages), other["assistantMessages"].clone()),
            ("costo", Value::from(s.cost_usd), other["costUSD"].clone()),
            ("modelo", Value::from(s.model.clone()), other["model"].clone()),
        ];
        for (name, rust, swift) in checks {
            let same_number = rust.as_f64().zip(swift.as_f64()).is_some_and(|(a, b)| (a - b).abs() < 1e-9);
            if rust != swift && !same_number {
                differences += 1;
                println!("  ≠ {name} en {}: Rust={rust} Swift={swift}", s.id);
            }
        }
    }
    println!("Comparadas {compared} sesiones con la app de Swift: {differences} diferencias");

    let dir = std::env::temp_dir().join("lap-parity");
    let _ = std::fs::remove_dir_all(&dir);
    let mut index = SearchIndex::open(&dir.join("search.sqlite")).unwrap();
    let start = Instant::now();
    let indexed = index.update(&sessions, |_, _| {}).unwrap();
    println!("Índice de búsqueda: {indexed} sesiones en {:.2?}", start.elapsed());
    let start = Instant::now();
    let hits = index.search("stripe", 10).unwrap();
    println!("Búsqueda de prueba: {} resultados en {:.2?}", hits.len(), start.elapsed());
    let _ = std::fs::remove_dir_all(&dir);
}
