import Foundation
import SQLite3

/// Índice de texto completo de las conversaciones (SQLite FTS5, incluido en macOS).
///
/// Es una caché: se puede borrar y se reconstruye sola. Solo guarda tus mensajes y las
/// respuestas de Claude, no los resultados de herramientas.
actor SearchIndex {
    struct Hit: Sendable {
        var sessionID: UUID
        /// Fragmento con la coincidencia entre `\u{1}` y `\u{2}`.
        var snippet: String
    }

    private var db: OpaquePointer?

    static var url: URL {
        URL.applicationSupportDirectory.appending(path: "LostAndPrompt/search.sqlite")
    }

    init() {
        try? FileManager.default.createDirectory(at: Self.url.deletingLastPathComponent(), withIntermediateDirectories: true)
        var handle: OpaquePointer?
        guard sqlite3_open_v2(Self.url.path, &handle, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            return
        }
        db = handle
        Self.exec(handle, """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS files (session TEXT PRIMARY KEY, modified REAL NOT NULL, size INTEGER NOT NULL);
            CREATE VIRTUAL TABLE IF NOT EXISTS messages USING fts5(
                session UNINDEXED, role UNINDEXED, text,
                tokenize = 'unicode61 remove_diacritics 2'
            );
            """)
    }

    /// Indexa las sesiones nuevas o cambiadas y quita las que ya no existen. Devuelve cuántas indexó.
    @discardableResult
    func update(with summaries: [SessionSummary], progress: @Sendable (Int, Int) -> Void = { _, _ in }) -> Int {
        guard let db else { return 0 }
        let known = indexedFiles()
        let current = Set(summaries.map { $0.id.uuidString })
        for stale in Set(known.keys).subtracting(current) { delete(stale) }

        let pending = summaries.filter { summary in
            guard let entry = known[summary.id.uuidString] else { return summary.userMessages > 0 }
            return entry.modified != summary.modified.timeIntervalSince1970 || entry.size != summary.size
        }
        for (offset, summary) in pending.enumerated() {
            progress(offset, pending.count)
            let messages = ClaudeStore.messages(at: summary.path)
            Self.exec(db, "BEGIN")
            delete(summary.id.uuidString)
            insertFile(summary)
            for message in messages where !message.text.isEmpty {
                insertMessage(session: summary.id.uuidString, role: message.role == .user ? "user" : "assistant", text: message.text)
            }
            Self.exec(db, "COMMIT")
        }
        progress(pending.count, pending.count)
        return pending.count
    }

    /// Busca palabras (con prefijo) y devuelve como mucho una coincidencia por sesión.
    func search(_ query: String, limit: Int = 60) -> [Hit] {
        guard let db, let match = Self.matchExpression(query) else { return [] }
        let sql = """
            SELECT session, snippet(messages, 2, char(1), char(2), '…', 14)
            FROM messages WHERE messages MATCH ? ORDER BY rank LIMIT 400
            """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, match, -1, Self.transient)
        var hits: [Hit] = []
        var seen = Set<UUID>()
        while sqlite3_step(statement) == SQLITE_ROW, hits.count < limit {
            guard let rawID = sqlite3_column_text(statement, 0), let id = UUID(uuidString: String(cString: rawID)),
                  seen.insert(id).inserted else { continue }
            let snippet = sqlite3_column_text(statement, 1).map { String(cString: $0) } ?? ""
            hits.append(Hit(sessionID: id, snippet: snippet.replacingOccurrences(of: "\n", with: " ")))
        }
        return hits
    }

    // MARK: Ayudantes

    /// `silk song` → `"silk"* "song"*`: cada palabra como prefijo, sin sintaxis FTS del usuario.
    static func matchExpression(_ query: String) -> String? {
        let words = query.split(whereSeparator: \.isWhitespace).map { $0.replacingOccurrences(of: "\"", with: "") }.filter { !$0.isEmpty }
        guard !words.isEmpty else { return nil }
        return words.map { "\"\($0)\"*" }.joined(separator: " ")
    }

    private func indexedFiles() -> [String: (modified: Double, size: Int64)] {
        var result: [String: (Double, Int64)] = [:]
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT session, modified, size FROM files", -1, &statement, nil) == SQLITE_OK else { return [:] }
        defer { sqlite3_finalize(statement) }
        while sqlite3_step(statement) == SQLITE_ROW {
            guard let raw = sqlite3_column_text(statement, 0) else { continue }
            result[String(cString: raw)] = (sqlite3_column_double(statement, 1), sqlite3_column_int64(statement, 2))
        }
        return result
    }

    private func delete(_ session: String) {
        run("DELETE FROM messages WHERE session = ?", session)
        run("DELETE FROM files WHERE session = ?", session)
    }

    private func insertFile(_ summary: SessionSummary) {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "INSERT OR REPLACE INTO files (session, modified, size) VALUES (?, ?, ?)", -1, &statement, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, summary.id.uuidString, -1, Self.transient)
        sqlite3_bind_double(statement, 2, summary.modified.timeIntervalSince1970)
        sqlite3_bind_int64(statement, 3, summary.size)
        sqlite3_step(statement)
    }

    private func insertMessage(session: String, role: String, text: String) {
        run("INSERT INTO messages (session, role, text) VALUES (?, ?, ?)", session, role, text)
    }

    private func run(_ sql: String, _ values: String...) {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(statement) }
        for (index, value) in values.enumerated() { sqlite3_bind_text(statement, Int32(index + 1), value, -1, Self.transient) }
        sqlite3_step(statement)
    }

    private static func exec(_ db: OpaquePointer?, _ sql: String) {
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
}
