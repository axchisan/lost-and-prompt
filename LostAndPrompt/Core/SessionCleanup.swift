import Foundation

/// Eliminar sesiones de Claude Code «a nivel Claude»: la conversación y todo lo que Claude Code
/// guarda de ella. Es el equivalente de `core/src/cleanup.rs` y sigue las mismas reglas:
/// plan previo, nunca una sesión abierta, papelera por defecto y `history.jsonl` reescrito de forma
/// atómica con una copia antes.
nonisolated enum SessionCleanup {
    enum Kind: String, CaseIterable, Sendable {
        case conversation, subagents, fileHistory, environment, tasks, todos, debug

        var title: String {
            switch self {
            case .conversation: String(localized: "La conversación")
            case .subagents: String(localized: "Subagentes y resultados de herramientas")
            case .fileHistory: String(localized: "Copias de los archivos editados (para rebobinar)")
            case .environment: String(localized: "Entorno de la sesión")
            case .tasks: String(localized: "Tareas")
            case .todos: String(localized: "Listas de tareas antiguas")
            case .debug: String(localized: "Registro de depuración")
            }
        }
    }

    struct Item: Sendable {
        var session: UUID
        var kind: Kind
        var url: URL
        var bytes: Int64
    }

    struct Target: Sendable {
        var id: UUID
        var file: URL
    }

    struct HistoryEdit: Sendable {
        var file: URL
        var lines: Int
        var sessions: Set<UUID>
    }

    struct Plan: Sendable {
        var items: [Item] = []
        var history: [HistoryEdit] = []
        /// Abiertas ahora mismo en Claude Code: no se borran.
        var inUse: Set<UUID> = []

        var totalBytes: Int64 { items.reduce(0) { $0 + $1.bytes } }
        var historyLines: Int { history.reduce(0) { $0 + $1.lines } }
        var sessions: Set<UUID> { Set(items.map(\.session)) }
        /// Por tipo, en el orden de `Kind`: cuántos elementos y cuánto ocupan.
        var kinds: [(kind: Kind, bytes: Int64)] {
            Kind.allCases.compactMap { kind in
                let list = items.filter { $0.kind == kind }
                return list.isEmpty ? nil : (kind, list.reduce(0) { $0 + $1.bytes })
            }
        }
    }

    enum CleanupError: LocalizedError {
        case inUse
        case partial([String])

        var errorDescription: String? {
            switch self {
            case .inUse: String(localized: "Una de las sesiones está abierta en Claude Code. Ciérrala en la terminal primero.")
            case .partial(let failures): String(localized: "No se pudo quitar todo:") + "\n" + failures.joined(separator: "\n")
            }
        }
    }

    static var backupsURL: URL { URL.applicationSupportDirectory.appending(path: "LostAndPrompt/backups", directoryHint: .isDirectory) }

    /// `<config>/projects/<carpeta>/<id>.jsonl` → `<config>`.
    static func configDir(of file: URL) -> URL? {
        let projects = file.deletingLastPathComponent().deletingLastPathComponent()
        return projects.lastPathComponent == "projects" ? projects.deletingLastPathComponent() : nil
    }

    /// Todos los archivos de la sesión en una carpeta `projects` (la original y las copias de
    /// «Elegir carpeta…» o de importar en otra carpeta).
    static func copies(of id: UUID, in projects: URL) -> [URL] {
        let name = id.uuidString.lowercased() + ".jsonl"
        let folders = (try? FileManager.default.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil)) ?? []
        return folders.map { $0.appending(path: name) }.filter { FileManager.default.fileExists(atPath: $0.path) }.sorted { $0.path < $1.path }
    }

    // MARK: Plan

    static func plan(_ targets: [Target]) -> Plan {
        var plan = Plan()
        let fm = FileManager.default
        for (config, list) in Dictionary(grouping: targets, by: { configDir(of: $0.file) }) {
            guard let config else { continue }
            let open = openSessions(in: config)
            let ids = Set(list.map(\.id))
            let remainingPrefixes = Set(allSessionIDs(in: config).filter { !ids.contains($0) }.map(prefix))
            for target in list {
                if open.contains(target.id) { plan.inUse.insert(target.id); continue }
                let id = target.id.uuidString.lowercased()
                func add(_ kind: Kind, _ url: URL) {
                    guard fm.fileExists(atPath: url.path) else { return }
                    plan.items.append(Item(session: target.id, kind: kind, url: url, bytes: size(of: url)))
                }
                add(.conversation, target.file)
                add(.subagents, target.file.deletingPathExtension())
                add(.fileHistory, config.appending(path: "file-history/\(id)"))
                add(.environment, config.appending(path: "session-env/\(id)"))
                if !remainingPrefixes.contains(prefix(target.id)) {
                    add(.tasks, config.appending(path: "tasks/session-\(prefix(target.id))"))
                }
                let todos = config.appending(path: "todos")
                for name in (try? fm.contentsOfDirectory(atPath: todos.path)) ?? [] where name.hasPrefix(id + "-") {
                    add(.todos, todos.appending(path: name))
                }
                add(.debug, config.appending(path: "debug/\(id).txt"))
            }
            let wanted = ids.subtracting(plan.inUse)
            let history = config.appending(path: "history.jsonl")
            let (lines, sessions) = countHistory(history, wanted)
            if lines > 0 { plan.history.append(HistoryEdit(file: history, lines: lines, sessions: sessions)) }
        }
        return plan
    }

    // MARK: Ejecutar

    /// Devuelve las sesiones borradas. Antes vuelve a comprobar que ninguna se abrió mientras tanto.
    static func execute(_ plan: Plan, permanent: Bool) throws -> Set<UUID> {
        let fm = FileManager.default
        let planned = plan.sessions
        let configs = Set(plan.items.compactMap { configOfItem($0) } + plan.history.map { $0.file.deletingLastPathComponent() })
        for config in configs where !openSessions(in: config).isDisjoint(with: planned) {
            throw CleanupError.inUse
        }
        // Primero el historial (con copia): si falla, no se ha borrado nada.
        for edit in plan.history {
            try rewriteHistory(edit.file, removing: edit.sessions)
        }
        var failed: Set<UUID> = []
        var failures: [String] = []
        for item in plan.items {
            do {
                if permanent { try fm.removeItem(at: item.url) } else { try fm.trashItem(at: item.url, resultingItemURL: nil) }
            } catch {
                failed.insert(item.session)
                failures.append("\(item.url.path): \(error.localizedDescription)")
            }
        }
        if !failures.isEmpty { throw CleanupError.partial(failures) }
        return planned.subtracting(failed)
    }

    private static func configOfItem(_ item: Item) -> URL? {
        switch item.kind {
        case .conversation: configDir(of: item.url)
        case .subagents: configDir(of: item.url.appendingPathExtension("jsonl"))
        default: item.url.deletingLastPathComponent().deletingLastPathComponent()
        }
    }

    // MARK: Sesiones abiertas

    /// Sesiones con un proceso de Claude Code vivo (`sessions/<pid>.json`).
    static func openSessions(in config: URL) -> Set<UUID> {
        Set(openSessionsWithCWD(in: config).map(\.id))
    }

    /// Como `openSessions`, con la carpeta donde corre cada una (si la apunta).
    static func openSessionsWithCWD(in config: URL) -> [(id: UUID, cwd: String?)] {
        let folder = config.appending(path: "sessions")
        let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
        var result: [(id: UUID, cwd: String?)] = []
        for name in names where name.hasSuffix(".json") {
            guard let data = try? Data(contentsOf: folder.appending(path: name)),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let id = (object["sessionId"] as? String).flatMap(UUID.init(uuidString:)),
                  let pid = object["pid"] as? Int else { continue }
            // kill con la señal 0 no envía nada: solo comprueba que el proceso existe.
            if kill(pid_t(pid), 0) == 0 || errno == EPERM { result.append((id, object["cwd"] as? String)) }
        }
        return result
    }

    // MARK: history.jsonl

    private static func sessionID(of line: Substring) -> UUID? {
        guard let data = line.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return (object["sessionId"] as? String).flatMap(UUID.init(uuidString:))
    }

    private static func countHistory(_ file: URL, _ wanted: Set<UUID>) -> (Int, Set<UUID>) {
        guard !wanted.isEmpty, let text = try? String(contentsOf: file, encoding: .utf8) else { return (0, []) }
        var lines = 0
        var found: Set<UUID> = []
        for line in text.split(separator: "\n") {
            // Solo se interpreta el JSON de las líneas que nombran alguna de las sesiones.
            guard wanted.contains(where: { line.contains($0.uuidString.lowercased()) }),
                  let id = sessionID(of: line), wanted.contains(id) else { continue }
            lines += 1
            found.insert(id)
        }
        return (lines, found)
    }

    /// Reescribe `history.jsonl` sin las líneas de esas sesiones, después de guardar una copia.
    static func rewriteHistory(_ file: URL, removing sessions: Set<UUID>) throws {
        let text = try String(contentsOf: file, encoding: .utf8)
        let fm = FileManager.default
        try fm.createDirectory(at: backupsURL, withIntermediateDirectories: true)
        let account = file.deletingLastPathComponent().lastPathComponent.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let stamp = Date().formatted(.iso8601.year().month().day().dateSeparator(.dash).time(includingFractionalSeconds: false).timeSeparator(.omitted))
        try fm.copyItem(at: file, to: backupsURL.appending(path: "history-\(account)-\(stamp).jsonl"))
        var lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        if text.hasSuffix("\n") { lines.removeLast() }
        let remaining = lines.filter { line in
            !(sessions.contains(where: { line.contains($0.uuidString.lowercased()) }) && sessionID(of: line).map(sessions.contains) == true)
        }
        var kept = remaining.joined(separator: "\n")
        if text.hasSuffix("\n") && !remaining.isEmpty { kept += "\n" }
        // `.atomic` escribe en un archivo temporal y lo renombra: nunca queda a medias.
        try kept.write(to: file, atomically: true, encoding: .utf8)
    }

    // MARK: Ayudantes

    private static func prefix(_ id: UUID) -> String { String(id.uuidString.lowercased().prefix(8)) }

    private static func allSessionIDs(in config: URL) -> [UUID] {
        let fm = FileManager.default
        let projects = config.appending(path: "projects")
        let folders = (try? fm.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil)) ?? []
        return folders.flatMap { folder in
            ((try? fm.contentsOfDirectory(atPath: folder.path)) ?? []).compactMap { name in
                name.hasSuffix(".jsonl") ? UUID(uuidString: String(name.dropLast(6))) : nil
            }
        }
    }

    private static func size(of url: URL) -> Int64 {
        let fm = FileManager.default
        var isDirectory: ObjCBool = false
        guard fm.fileExists(atPath: url.path, isDirectory: &isDirectory) else { return 0 }
        guard isDirectory.boolValue else {
            return (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(Int64.init) ?? 0
        }
        let enumerator = fm.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey])
        var total: Int64 = 0
        while let file = enumerator?.nextObject() as? URL {
            total += Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        }
        return total
    }
}
