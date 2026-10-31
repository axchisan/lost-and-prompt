import Foundation

/// Resumen de un archivo de sesión de Claude Code (`~/.claude/projects/<carpeta>/<id>.jsonl`).
nonisolated struct SessionSummary: Codable, Sendable {
    var id: UUID
    var path: String
    var size: Int64
    var modified: Date
    var aiTitle: String?
    var cwd: String?
    var gitBranch: String?
    var startedAt: Date?
    var userMessages = 0
    var assistantMessages = 0
    var costUSD: Double?
    var model: String?
    var firstPrompt: String?
    var lastReply: String?
}

/// Lectura tolerante y de solo lectura de las sesiones de Claude Code.
///
/// El formato es interno y cambia entre versiones: todo campo es opcional y los tipos de
/// registro desconocidos se ignoran.
nonisolated enum ClaudeStore {
    static var projectsURL: URL {
        FileManager.default.homeDirectoryForCurrentUser.appending(path: ".claude/projects", directoryHint: .isDirectory)
    }

    static var cacheURL: URL {
        URL.applicationSupportDirectory.appending(path: "LostAndPrompt/index-cache.json")
    }

    /// Escanea todas las sesiones. Reutiliza la caché para los archivos que no cambiaron.
    @concurrent
    static func scan() async -> [SessionSummary] {
        let files = sessionFiles()
        var cache = loadCache()
        let results = await withTaskGroup(of: SessionSummary?.self) { group in
            for (url, size, modified) in files {
                if let cached = cache[url.path], cached.size == size, cached.modified == modified {
                    group.addTask { cached }
                } else {
                    group.addTask { summarize(url: url, size: size, modified: modified) }
                }
            }
            var list: [SessionSummary] = []
            for await summary in group { if let summary { list.append(summary) } }
            return list
        }
        cache = Dictionary(results.map { ($0.path, $0) }, uniquingKeysWith: { a, _ in a })
        saveCache(cache)
        return results
    }

    private static func sessionFiles() -> [(URL, Int64, Date)] {
        let fm = FileManager.default
        let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey, .isDirectoryKey]
        guard let folders = try? fm.contentsOfDirectory(at: projectsURL, includingPropertiesForKeys: keys) else { return [] }
        var files: [(URL, Int64, Date)] = []
        for folder in folders {
            guard let items = try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: keys) else { continue }
            for url in items where url.pathExtension == "jsonl" && UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil {
                let values = try? url.resourceValues(forKeys: Set(keys))
                files.append((url, Int64(values?.fileSize ?? 0), values?.contentModificationDate ?? .distantPast))
            }
        }
        return files
    }

    // MARK: Resumen de un archivo

    static func summarize(url: URL, size: Int64, modified: Date) -> SessionSummary? {
        guard let id = UUID(uuidString: url.deletingPathExtension().lastPathComponent),
              let data = try? Data(contentsOf: url, options: .alwaysMapped) else { return nil }
        var summary = SessionSummary(id: id, path: url.path, size: size, modified: modified)
        var recentAssistant: [Range<Int>] = []
        var directories: [String] = []

        data.withUnsafeBytes { buffer in
            forEachLine(in: buffer) { line, range in
                if contains(line, Marker.assistant) {
                    summary.assistantMessages += 1
                    recentAssistant.append(range)
                    if recentAssistant.count > 12 { recentAssistant.removeFirst() }
                } else if contains(line, Marker.user) {
                    guard !contains(line, Marker.toolResult), let object = json(line) else { return }
                    if let cwd = object["cwd"] as? String, directories.count < 20, !directories.contains(cwd) { directories.append(cwd) }
                    if summary.gitBranch == nil { summary.gitBranch = object["gitBranch"] as? String }
                    if summary.startedAt == nil { summary.startedAt = date(object["timestamp"]) }
                    guard let text = humanText(object) else { return }
                    summary.userMessages += 1
                    if summary.firstPrompt == nil { summary.firstPrompt = String(text.prefix(400)) }
                } else if contains(line, Marker.aiTitle) {
                    summary.aiTitle = json(line)?["aiTitle"] as? String
                } else if contains(line, Marker.summary), summary.aiTitle == nil {
                    summary.aiTitle = json(line)?["summary"] as? String
                } else if contains(line, Marker.costState) {
                    summary.costUSD = json(line)?["totalCostUSD"] as? Double
                }
            }

            // El cwd válido es el que corresponde a la carpeta donde vive el archivo; si ninguno
            // coincide (formato desconocido), el primero.
            let folder = url.deletingLastPathComponent().lastPathComponent
            summary.cwd = directories.first { $0.replacing(/[^A-Za-z0-9]/, with: "-") == folder } ?? directories.first

            for range in recentAssistant.reversed() {
                let line = UnsafeRawBufferPointer(rebasing: buffer[range])
                guard let message = json(line)?["message"] as? [String: Any] else { continue }
                if summary.model == nil, let model = message["model"] as? String { summary.model = model }
                if summary.lastReply == nil, let text = texts(message).last { summary.lastReply = String(text.prefix(400)) }
                if summary.model != nil && summary.lastReply != nil { break }
            }
        }
        return summary
    }

    // MARK: Conversación completa (bajo demanda)

    static func messages(at path: String) -> [Message] {
        guard let data = try? Data(contentsOf: URL(filePath: path), options: .alwaysMapped) else { return [] }
        var result: [Message] = []
        data.withUnsafeBytes { buffer in
            forEachLine(in: buffer) { line, _ in
                if contains(line, Marker.assistant) {
                    guard let object = json(line), let message = object["message"] as? [String: Any] else { return }
                    let when = date(object["timestamp"]) ?? .distantPast
                    let blocks = message["content"] as? [[String: Any]] ?? []
                    for block in blocks {
                        switch block["type"] as? String {
                        case "text":
                            if let text = block["text"] as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                result.append(Message(role: .assistant, date: when, text: text))
                            }
                        case "thinking":
                            // Muchas veces viene vacío (solo la firma): esos no se muestran.
                            if let text = block["thinking"] as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                result.append(Message(role: .assistant, date: when, text: text, isThinking: true))
                            }
                        case "tool_use":
                            if let last = result.indices.last, result[last].role == .assistant, !result[last].isThinking {
                                result[last].toolCount += 1
                            } else {
                                result.append(Message(role: .assistant, date: when, text: "", toolCount: 1))
                            }
                        default: break
                        }
                    }
                } else if contains(line, Marker.user), !contains(line, Marker.toolResult),
                          let object = json(line), let text = humanText(object) {
                    result.append(Message(role: .user, date: date(object["timestamp"]) ?? .distantPast, text: text))
                }
            }
        }
        return result
    }

    // MARK: Ayudantes

    private enum Marker {
        static let user = Array(#""type":"user""#.utf8)
        static let assistant = Array(#""type":"assistant""#.utf8)
        static let aiTitle = Array(#""type":"ai-title""#.utf8)
        static let summary = Array(#""type":"summary""#.utf8)
        static let costState = Array(#""type":"cost-state""#.utf8)
        static let toolResult = Array(#""tool_use_id""#.utf8)
    }

    /// Recorre las líneas sin copiar bytes (`memchr`), con su rango dentro del archivo.
    private static func forEachLine(in buffer: UnsafeRawBufferPointer, _ body: (UnsafeRawBufferPointer, Range<Int>) -> Void) {
        guard let base = buffer.baseAddress else { return }
        let count = buffer.count
        var start = 0
        while start < count {
            let end = memchr(base + start, 0x0A, count - start).map { UnsafeRawPointer($0) - base } ?? count
            if end > start { body(UnsafeRawBufferPointer(start: base + start, count: end - start), start..<end) }
            start = end + 1
        }
    }

    private static func contains(_ line: UnsafeRawBufferPointer, _ marker: [UInt8]) -> Bool {
        guard let base = line.baseAddress else { return false }
        return marker.withUnsafeBytes { memmem(base, line.count, $0.baseAddress, $0.count) != nil }
    }

    private static func json(_ line: UnsafeRawBufferPointer) -> [String: Any]? {
        let data = Data(bytesNoCopy: UnsafeMutableRawPointer(mutating: line.baseAddress!), count: line.count, deallocator: .none)
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    /// Texto escrito por la persona; descarta recordatorios del sistema, comandos y mensajes internos.
    private static func humanText(_ object: [String: Any]) -> String? {
        if object["isMeta"] as? Bool == true || object["isSidechain"] as? Bool == true { return nil }
        guard let message = object["message"] as? [String: Any] else { return nil }
        let text: String
        if let string = message["content"] as? String {
            text = string
        } else {
            text = texts(message).joined(separator: "\n")
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.hasPrefix("<"), !trimmed.hasPrefix("[Request interrupted") else { return nil }
        return trimmed
    }

    private static func texts(_ message: [String: Any]) -> [String] {
        (message["content"] as? [[String: Any]] ?? []).compactMap { block in
            block["type"] as? String == "text" ? block["text"] as? String : nil
        }
    }

    private static func date(_ value: Any?) -> Date? {
        guard let string = value as? String else { return nil }
        if let date = try? Date(string, strategy: .iso8601.year().month().day().time(includingFractionalSeconds: true)) {
            return date
        }
        return try? Date(string, strategy: .iso8601)
    }

    private static func loadCache() -> [String: SessionSummary] {
        guard let data = try? Data(contentsOf: cacheURL) else { return [:] }
        return (try? JSONDecoder().decode([String: SessionSummary].self, from: data)) ?? [:]
    }

    private static func saveCache(_ cache: [String: SessionSummary]) {
        try? FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? JSONEncoder().encode(cache).write(to: cacheURL, options: .atomic)
    }
}
