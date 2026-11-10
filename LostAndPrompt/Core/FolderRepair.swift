import Foundation

/// Reparar carpetas movidas: pasa las sesiones, la memoria y los ajustes de Claude Code de una
/// carpeta de trabajo (y sus subcarpetas) a su ruta nueva. Equivalente de `core/src/relocate.rs`,
/// con las mismas salvaguardas: plan previo, nunca con una sesión abierta, copia de todo lo que se
/// reescribe y escrituras atómicas. No mueve la carpeta del disco.
nonisolated enum FolderRepair {
    struct FolderMove: Sendable, Identifiable {
        var id: String { fromDir.path }
        var fromCWD: String
        var toCWD: String
        var fromDir: URL
        var toDir: URL
        var sessions: Int
        var merge: Bool
        var hasMemory: Bool
    }

    struct Plan: Sendable {
        var configDir: URL
        var claudeJSON: URL
        var from: String
        var to: String
        var folders: [FolderMove] = []
        var files: [URL] = []
        var historyLines = 0
        var settingsKeys: [String] = []
        var inUse: Set<UUID> = []

        var isEmpty: Bool { folders.isEmpty && historyLines == 0 && settingsKeys.isEmpty }
    }

    enum RepairError: LocalizedError {
        case inUse
        var errorDescription: String? { String(localized: "Hay una sesión abierta en esa carpeta. Ciérrala en la terminal primero.") }
    }

    /// `~/.claude.json` para `~/.claude`; `<carpeta>/.claude.json` para las demás cuentas.
    static func claudeJSON(for account: ClaudeAccount) -> URL {
        account.isDefault
            ? URL(filePath: ClaudeAccounts.homePath + "/.claude.json")
            : account.configURL.appending(path: ".claude.json")
    }

    static func encode(_ path: String) -> String { path.replacing(/[^A-Za-z0-9]/, with: "-") }

    /// `path` es `folder` o está dentro: devuelve el resto (vacío o empezando por `/`).
    static func rest(of path: String, in folder: String) -> String? {
        let folder = folder.hasSuffix("/") ? String(folder.dropLast()) : folder
        guard path.hasPrefix(folder) else { return nil }
        let rest = String(path.dropFirst(folder.count))
        return rest.isEmpty || rest.hasPrefix("/") ? rest : nil
    }

    // MARK: Plan

    static func plan(account: ClaudeAccount, from rawFrom: String, to rawTo: String) -> Plan {
        let from = rawFrom.count > 1 && rawFrom.hasSuffix("/") ? String(rawFrom.dropLast()) : rawFrom
        let to = rawTo.count > 1 && rawTo.hasSuffix("/") ? String(rawTo.dropLast()) : rawTo
        let json = claudeJSON(for: account)
        var plan = Plan(configDir: account.configURL, claudeJSON: json, from: from, to: to)
        guard from != to else { return plan }
        let fm = FileManager.default
        let settingKeys = projectKeys(in: json)
        plan.settingsKeys = settingKeys.filter { rest(of: $0, in: from) != nil }

        let encoded = encode(from)
        let projects = account.projectsURL
        let folders = ((try? fm.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil)) ?? []).sorted { $0.path < $1.path }
        for dir in folders {
            let name = dir.lastPathComponent
            guard name == encoded || name.hasPrefix(encoded + "-") else { continue }
            let sessions = jsonlFiles(in: dir)
            let cwd = sessions.lazy.compactMap { firstCWD($0) }.first { encode($0) == name }
                ?? settingKeys.first { encode($0) == name }
                ?? (name == encoded ? from : nil)
            guard let cwd, let rest = rest(of: cwd, in: from) else { continue }
            let toCWD = to + rest
            let toDir = projects.appending(path: encode(toCWD), directoryHint: .isDirectory)
            plan.files += sessions + subagentFiles(in: dir)
            plan.folders.append(FolderMove(fromCWD: cwd, toCWD: toCWD, fromDir: dir, toDir: toDir, sessions: sessions.count,
                                           merge: fm.fileExists(atPath: toDir.path) && toDir.path != dir.path,
                                           hasMemory: fm.fileExists(atPath: dir.appending(path: "memory").path)))
        }
        if let text = try? String(contentsOf: account.configURL.appending(path: "history.jsonl"), encoding: .utf8) {
            plan.historyLines = replace(key: "project", in: text, from: from, to: to).count
        }
        for (id, cwd) in SessionCleanup.openSessionsWithCWD(in: account.configURL) {
            if let cwd, rest(of: cwd, in: from) != nil { plan.inUse.insert(id) }
            if cwd == nil, plan.files.contains(where: { $0.deletingPathExtension().lastPathComponent == id.uuidString.lowercased() }) {
                plan.inUse.insert(id)
            }
        }
        return plan
    }

    // MARK: Ejecutar

    /// Devuelve la carpeta con la copia de lo que se reescribió.
    @discardableResult
    static func execute(account: ClaudeAccount, from: String, to: String, backups: URL) throws -> URL {
        let plan = plan(account: account, from: from, to: to)
        guard plan.inUse.isEmpty else { throw RepairError.inUse }
        let fm = FileManager.default
        let stamp = Date().formatted(.iso8601.year().month().day().dateSeparator(.dash).time(includingFractionalSeconds: false).timeSeparator(.omitted))
        let backup = backups.appending(path: "reparar-\(stamp)-\(account.configURL.lastPathComponent)", directoryHint: .isDirectory)
        try fm.createDirectory(at: backup, withIntermediateDirectories: true)

        // 1. Copias.
        let projectsPath = account.projectsURL.path + "/"
        for file in plan.files {
            let relative = file.path.hasPrefix(projectsPath) ? String(file.path.dropFirst(projectsPath.count)) : file.lastPathComponent
            let target = backup.appending(path: "projects/" + relative)
            try fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try fm.copyItem(at: file, to: target)
        }
        let history = account.configURL.appending(path: "history.jsonl")
        if fm.fileExists(atPath: history.path) { try fm.copyItem(at: history, to: backup.appending(path: "history.jsonl")) }
        if fm.fileExists(atPath: plan.claudeJSON.path) { try fm.copyItem(at: plan.claudeJSON, to: backup.appending(path: ".claude.json")) }

        // 2. Conversaciones y carpetas de proyecto.
        for file in plan.files {
            let text = try String(contentsOf: file, encoding: .utf8)
            let (changed, count) = replace(key: "cwd", in: text, from: plan.from, to: plan.to)
            if count > 0 { try changed.write(to: file, atomically: true, encoding: .utf8) }
        }
        for folder in plan.folders where folder.toDir.path != folder.fromDir.path {
            if fm.fileExists(atPath: folder.toDir.path) {
                try merge(folder.fromDir, into: folder.toDir)
            } else {
                try fm.moveItem(at: folder.fromDir, to: folder.toDir)
            }
        }

        // 3. Historial de lo escrito.
        if let text = try? String(contentsOf: history, encoding: .utf8) {
            let (changed, count) = replace(key: "project", in: text, from: plan.from, to: plan.to)
            if count > 0 { try changed.write(to: history, atomically: true, encoding: .utf8) }
        }

        // 4. Ajustes por carpeta: solo las claves de `projects` en `.claude.json`, sobre el texto
        // para no reordenar ni tocar nada más del archivo (guarda la cuenta).
        if !plan.settingsKeys.isEmpty, let text = try? String(contentsOf: plan.claudeJSON, encoding: .utf8) {
            let changed = renameProjectKeys(in: text, from: plan.from, to: plan.to)
            if changed != text { try changed.write(to: plan.claudeJSON, atomically: true, encoding: .utf8) }
        }
        return backup
    }

    // MARK: Texto

    /// Lo que JSON escapa en una ruta (Claude Code no escapa `/`).
    private static func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    }

    /// Cambia `"<clave>":"<from>…"` por `"<clave>":"<to>…"` cuando el valor es `from` o está dentro.
    static func replace(key: String, in text: String, from: String, to: String) -> (text: String, count: Int) {
        let needle = "\"\(key)\":\"\(escape(from))"
        let replacement = "\"\(key)\":\"\(escape(to))"
        var result = ""
        result.reserveCapacity(text.utf8.count)
        var count = 0
        var rest = text[...]
        while let range = rest.range(of: needle) {
            result += rest[..<range.lowerBound]
            let after = rest[range.upperBound...]
            if after.hasPrefix("\"") || after.hasPrefix("/") {
                result += replacement
                count += 1
            } else {
                result += needle
            }
            rest = after
        }
        result += rest
        return (result, count)
    }

    /// Claves de `projects` en `.claude.json`.
    private static func projectKeys(in file: URL) -> [String] {
        guard let data = try? Data(contentsOf: file),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let projects = object["projects"] as? [String: Any] else { return [] }
        return Array(projects.keys)
    }

    /// Renombra, dentro del bloque `"projects"` de `.claude.json` (con sangría de dos espacios, como lo
    /// escribe Claude Code), las claves que son `from` o están dentro. Si la ruta nueva ya tiene
    /// ajustes, se deja la vieja como está.
    static func renameProjectKeys(in text: String, from: String, to: String) -> String {
        guard let start = text.range(of: "\n  \"projects\": {\n"),
              let end = text.range(of: "\n  }", range: start.upperBound..<text.endIndex) else { return text }
        let block = text[start.upperBound..<end.lowerBound]
        let prefix = "    \"" + escape(from)
        var lines = block.components(separatedBy: "\n")
        let existing = Set(lines.compactMap { line -> String? in
            guard line.hasPrefix("    \""), !line.hasPrefix("     "), let close = line.range(of: "\": ") else { return nil }
            return String(line[line.index(line.startIndex, offsetBy: 5)..<close.lowerBound])
        })
        for index in lines.indices {
            let line = lines[index]
            guard line.hasPrefix(prefix), !line.hasPrefix("     "), let close = line.range(of: "\": ") else { continue }
            let key = String(line[line.index(line.startIndex, offsetBy: 5)..<close.lowerBound])
            guard let rest = rest(of: key, in: escape(from)) else { continue }
            let newKey = escape(to) + rest
            guard !existing.contains(newKey) else { continue }
            lines[index] = "    \"" + newKey + line[close.lowerBound...]
        }
        return String(text[..<start.upperBound]) + lines.joined(separator: "\n") + String(text[end.lowerBound...])
    }

    // MARK: Archivos

    private static func merge(_ from: URL, into to: URL) throws {
        let fm = FileManager.default
        try fm.createDirectory(at: to, withIntermediateDirectories: true)
        for item in try fm.contentsOfDirectory(at: from, includingPropertiesForKeys: nil) {
            let target = to.appending(path: item.lastPathComponent)
            var isDir: ObjCBool = false, targetIsDir: ObjCBool = false
            if !fm.fileExists(atPath: target.path, isDirectory: &targetIsDir) {
                try fm.moveItem(at: item, to: target)
            } else if fm.fileExists(atPath: item.path, isDirectory: &isDir), isDir.boolValue, targetIsDir.boolValue {
                try merge(item, into: target)
            } else {
                let stamp = Date().formatted(.iso8601.year().month().day().dateSeparator(.omitted).time(includingFractionalSeconds: false).timeSeparator(.omitted))
                try fm.moveItem(at: item, to: to.appending(path: item.lastPathComponent + ".movida-" + stamp))
            }
        }
        try fm.removeItem(at: from)
    }

    private static func jsonlFiles(in dir: URL) -> [URL] {
        ((try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.pathExtension == "jsonl" && UUID(uuidString: $0.deletingPathExtension().lastPathComponent) != nil }
            .sorted { $0.path < $1.path }
    }

    private static func subagentFiles(in dir: URL) -> [URL] {
        let fm = FileManager.default
        var found: [URL] = []
        for item in (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.isDirectoryKey])) ?? [] {
            guard item.lastPathComponent != "memory", (try? item.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true else { continue }
            let enumerator = fm.enumerator(at: item, includingPropertiesForKeys: nil)
            while let file = enumerator?.nextObject() as? URL {
                if file.pathExtension == "jsonl" { found.append(file) }
            }
        }
        return found.sorted { $0.path < $1.path }
    }

    /// Primer `cwd` de una conversación (mira solo el principio del archivo).
    private static func firstCWD(_ file: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: file) else { return nil }
        defer { try? handle.close() }
        guard let data = try? handle.read(upToCount: 512 * 1024), let text = String(data: data, encoding: .utf8) ?? String(data: data.dropLast(4), encoding: .utf8) else { return nil }
        for line in text.split(separator: "\n") where line.contains("\"cwd\":") {
            if let object = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any], let cwd = object["cwd"] as? String {
                return cwd
            }
        }
        return nil
    }
}
