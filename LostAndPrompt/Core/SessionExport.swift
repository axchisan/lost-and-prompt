import CoreTransferable
import Foundation
import UniformTypeIdentifiers

/// La conversación como Markdown, para leerla o compartirla: datos de la sesión arriba y luego tus
/// mensajes y las respuestas de Claude (sin el razonamiento ni las salidas de las herramientas).
enum SessionExport {
    static func markdown(_ session: Session, messages: [Message]) -> String {
        let date = Date.FormatStyle(date: .long, time: .shortened)
        var lines = ["# \(session.title)", ""]
        lines.append("- " + String(localized: "Carpeta: `\(session.abbreviatedPath)`"))
        lines.append("- " + String(localized: "Inició: \(session.startedAt.formatted(date))"))
        lines.append("- " + String(localized: "Última actividad: \(session.lastActivity.formatted(date))"))
        var facts = [session.model,
                     session.userMessages == 1 ? String(localized: "1 mensaje") : String(localized: "\(session.userMessages) mensajes")]
        if let cost = session.costUSD { facts.append(cost.usd) }
        if let branch = session.gitBranch { facts.append(String(localized: "Rama de git: `\(branch)`")) }
        lines += ["- " + facts.joined(separator: " · "), "", "> " + String(localized: "Exportada con Lost & Prompt"), "", "---", ""]
        for message in messages where !message.isThinking && (!message.text.isEmpty || message.toolCount > 0) {
            let who = message.role == .user ? String(localized: "Tú") : "Claude"
            lines += ["### \(who) · \(message.date.formatted(date: .omitted, time: .shortened))", ""]
            let text = message.text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { lines += [text, ""] }
            if message.toolCount > 0 {
                lines += ["_" + (message.toolCount == 1 ? String(localized: "1 herramienta") : String(localized: "\(message.toolCount) herramientas")) + "_", ""]
            }
        }
        return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines) + "\n"
    }

    /// Nombre de archivo a partir del título, sin los caracteres que no admiten otros sistemas.
    static func fileName(_ session: Session, extension ext: String) -> String {
        let base = session.title.replacing(/[\\\/:*?"<>|\n\r]+/, with: " ").replacing(/\s+/, with: " ")
            .trimmingCharacters(in: .whitespaces).prefix(80)
        return (base.isEmpty ? "Claude Code" : String(base)) + "." + ext
    }

    nonisolated static let markdownType = UTType("net.daringfireball.markdown") ?? .plainText

    /// Lee el `.jsonl` de una sesión compartida: su id y la carpeta donde se trabajó.
    static func inspect(_ url: URL) throws -> (id: UUID, cwd: String?) {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let data = try handle.read(upToCount: 4 << 20) ?? Data()
        var id: UUID?
        var cwd: String?
        for line in data.split(separator: UInt8(ascii: "\n")).prefix(400) {
            guard let object = try? JSONSerialization.jsonObject(with: Data(line)) as? [String: Any] else { continue }
            if id == nil, let value = object["sessionId"] as? String { id = UUID(uuidString: value) }
            if cwd == nil, let value = object["cwd"] as? String, !value.isEmpty { cwd = value }
            if id != nil, cwd != nil { break }
        }
        guard let id else { throw ExportError.notASession }
        return (id, cwd)
    }

    enum ExportError: LocalizedError {
        case notASession, alreadyThere
        var errorDescription: String? {
            switch self {
            case .notASession: String(localized: "El archivo no es una sesión de Claude Code.")
            case .alreadyThere: String(localized: "Ya tienes esta sesión en tu biblioteca.")
            }
        }
    }
}

/// La conversación en Markdown para «Compartir…»: el archivo se escribe al compartirla.
struct SessionMarkdownFile: Transferable {
    var session: Session

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: SessionExport.markdownType) { item in
            let path = await MainActor.run { item.session.filePath }
            let messages = path.map { ClaudeStore.messages(at: $0) } ?? []
            let (name, text) = await MainActor.run {
                (SessionExport.fileName(item.session, extension: "md"), SessionExport.markdown(item.session, messages: messages))
            }
            let folder = URL.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let url = folder.appending(path: name)
            try text.write(to: url, atomically: true, encoding: .utf8)
            return SentTransferredFile(url)
        }
    }
}
