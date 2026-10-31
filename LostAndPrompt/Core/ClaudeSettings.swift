import Foundation

/// Lectura y escritura de `cleanupPeriodDays` en `~/.claude/settings.json`.
enum ClaudeSettings {
    static var url: URL {
        FileManager.default.homeDirectoryForCurrentUser.appending(path: ".claude/settings.json")
    }

    /// Días que Claude Code conserva las sesiones; `nil` si usa el valor por defecto (30).
    static func retentionDays() -> Int? {
        guard let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return object["cleanupPeriodDays"] as? Int
    }

    /// Cambia la retención conservando el resto de ajustes. Antes guarda una copia del archivo.
    static func setRetentionDays(_ days: Int) throws {
        let fm = FileManager.default
        var object: [String: Any] = [:]
        if let data = try? Data(contentsOf: url) {
            guard let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw CocoaError(.fileReadCorruptFile)
            }
            object = parsed
            let stamp = Date().formatted(.iso8601.year().month().day().dateSeparator(.dash))
            let backup = url.deletingLastPathComponent().appending(path: "settings.json.bak-lostandprompt-\(stamp)")
            if !fm.fileExists(atPath: backup.path) { try fm.copyItem(at: url, to: backup) }
        }
        object["cleanupPeriodDays"] = days
        let data = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .withoutEscapingSlashes, .sortedKeys])
        try data.write(to: url, options: .atomic)
    }
}
