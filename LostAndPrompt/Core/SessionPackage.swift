import Foundation
import UniformTypeIdentifiers

/// Compartir sesiones para continuarlas en otro equipo: el paquete `.lap` (un zip). Es el mismo
/// formato que lee y escribe la app de Windows y Linux (`core/src/share.rs`):
///
///     manifest.json        qué es: título, carpeta, git, sistema de origen, opciones
///     session.jsonl        la sesión de Claude Code
///     conversation.md      la conversación para leer, para quien no tenga la app
///     files/subagents/…    lo que hay junto a la sesión (`<id>/`)
///     files/tool-results/… y las salidas largas de las herramientas
///
/// También se importa un `.jsonl` suelto (lo que exportaban las versiones anteriores).
nonisolated enum SessionPackage {
    static let fileExtension = "lap"
    static let format = 1
    static let omitted = "[Omitido al compartir con Lost & Prompt]"
    static let redactedMark = "[CLAVE-TAPADA]"
    static let type = UTType(exportedAs: "com.axchisan.lostandprompt.session", conformingTo: .zip)
    static let jsonlType = UTType(filenameExtension: "jsonl") ?? .json
    /// WhatsApp renombra los `.lap` a `.zip` al recibirlos (mira el contenido): se aceptan igual.
    static let openableExtensions: Set<String> = [fileExtension, "zip", "jsonl"]
    private static let maxUnpacked: Int64 = 2 << 30
    private static let maxEntries = 20_000

    /// Qué es un paquete: va en `manifest.json`.
    struct Manifest: Codable, Equatable {
        var format = SessionPackage.format
        var app = ""
        var exportedAt: Date?
        var os = "macos"
        var sessionId: UUID
        var title: String?
        var note: String?
        var cwd: String?
        var gitBranch: String?
        var gitRemote: String?
        var model: String?
        var messages = 0
        var startedAt: Date?
        var lastActivity: Date?
        var toolOutput = true
        var redacted = 0
        var sourceDir: String?

        init(sessionId: UUID) { self.sessionId = sessionId }

        // Como en Rust (`#[serde(default)]`): lo que falta toma su valor por defecto.
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            sessionId = try c.decode(UUID.self, forKey: .sessionId)
            format = try c.decodeIfPresent(Int.self, forKey: .format) ?? 0
            app = try c.decodeIfPresent(String.self, forKey: .app) ?? ""
            exportedAt = try c.decodeIfPresent(Date.self, forKey: .exportedAt)
            os = try c.decodeIfPresent(String.self, forKey: .os) ?? ""
            title = try c.decodeIfPresent(String.self, forKey: .title)
            note = try c.decodeIfPresent(String.self, forKey: .note)
            cwd = try c.decodeIfPresent(String.self, forKey: .cwd)
            gitBranch = try c.decodeIfPresent(String.self, forKey: .gitBranch)
            gitRemote = try c.decodeIfPresent(String.self, forKey: .gitRemote)
            model = try c.decodeIfPresent(String.self, forKey: .model)
            messages = try c.decodeIfPresent(Int.self, forKey: .messages) ?? 0
            startedAt = try c.decodeIfPresent(Date.self, forKey: .startedAt)
            lastActivity = try c.decodeIfPresent(Date.self, forKey: .lastActivity)
            toolOutput = try c.decodeIfPresent(Bool.self, forKey: .toolOutput) ?? false
            redacted = try c.decodeIfPresent(Int.self, forKey: .redacted) ?? 0
            sourceDir = try c.decodeIfPresent(String.self, forKey: .sourceDir)
        }
    }

    /// Lo que se sabe de un archivo compartido antes de importarlo.
    struct Shared {
        var manifest: Manifest
        /// `true` si es un paquete `.lap`; `false` si es un `.jsonl` suelto.
        var packaged: Bool
    }

    enum PackageError: LocalizedError {
        case notOurs, newer, damaged, tooBig, alreadyThere, tool(String)
        var errorDescription: String? {
            switch self {
            case .notOurs: String(localized: "El archivo no es una sesión de Lost & Prompt.")
            case .newer: String(localized: "La sesión se exportó con una versión más nueva de Lost & Prompt. Actualiza la app para importarla.")
            case .damaged: String(localized: "El archivo está dañado o no es un paquete de Lost & Prompt.")
            case .tooBig: String(localized: "El paquete es demasiado grande para importarlo.")
            case .alreadyThere: String(localized: "Ya tienes esta sesión en tu biblioteca.")
            case .tool(let message): message
            }
        }
    }

    // MARK: Fechas como las escribe Rust (RFC 3339, con o sin fracciones de segundo)

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fractional.date(from: text) ?? ISO8601DateFormatter().date(from: text) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "fecha: \(text)"))
        }
        return decoder
    }()

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        return encoder
    }()

    // MARK: Herramientas del sistema (zip y unzip vienen con macOS)

    @discardableResult
    private static func run(_ tool: String, _ arguments: [String], in directory: URL? = nil) throws -> Data {
        let process = Process()
        process.executableURL = URL(filePath: tool)
        process.arguments = arguments
        if let directory { process.currentDirectoryURL = directory }
        let output = Pipe()
        let errors = Pipe()
        process.standardOutput = output
        process.standardError = errors
        try process.run()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        let errorData = errors.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw PackageError.tool(String(decoding: errorData, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return data
    }

    // MARK: Leer

    static func isPackage(_ url: URL) -> Bool {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return false }
        defer { try? handle.close() }
        return (try? handle.read(upToCount: 4)) == Data([0x50, 0x4B, 0x03, 0x04])
    }

    /// Lee lo que trae un archivo compartido: un paquete `.lap` o un `.jsonl` suelto.
    static func inspect(_ url: URL) throws -> Shared {
        guard isPackage(url) else {
            let session = try SessionExport.inspect(url)
            var manifest = Manifest(sessionId: session.id)
            manifest.cwd = session.cwd
            manifest.title = session.title
            manifest.os = ""
            return Shared(manifest: manifest, packaged: false)
        }
        let names: [String]
        do {
            names = String(decoding: try run("/usr/bin/unzip", ["-Z1", url.path]), as: UTF8.self).split(separator: "\n").map(String.init)
        } catch {
            throw PackageError.damaged
        }
        guard names.contains("manifest.json"), names.contains("session.jsonl"),
              let data = try? run("/usr/bin/unzip", ["-p", url.path, "manifest.json"]),
              let manifest = try? decoder.decode(Manifest.self, from: data) else { throw PackageError.notOurs }
        guard manifest.format <= format else { throw PackageError.newer }
        return Shared(manifest: manifest, packaged: true)
    }

    // MARK: Claves

    private struct SecretPattern {
        let kind: String
        let regex: NSRegularExpression
        /// Grupo que se tapa (0 = todo lo encontrado).
        let group: Int
    }

    /// Los mismos formatos que en Rust. Las clases de caracteres excluyen `"` y `\` para que tapar una
    /// clave nunca corte un escape de JSON.
    private static let secrets: [SecretPattern] = {
        func p(_ kind: String, _ pattern: String, _ group: Int = 0) -> SecretPattern {
            SecretPattern(kind: kind, regex: try! NSRegularExpression(pattern: pattern), group: group)
        }
        return [
            p("anthropic", #"sk-ant-[A-Za-z0-9_\-]{20,}"#),
            p("openai", #"sk-(?:proj|svcacct|admin)-[A-Za-z0-9_\-]{20,}"#),
            p("github", #"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}"#),
            p("aws", #"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"#),
            p("google", #"AIza[0-9A-Za-z_\-]{35}"#),
            p("slack", #"xox[abprs]-[A-Za-z0-9\-]{10,}"#),
            p("stripe", #"(?:sk|rk)_live_[A-Za-z0-9]{20,}"#),
            p("resend", #"\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}"#),
            p("npm", #"\bnpm_[A-Za-z0-9]{36}\b"#),
            p("huggingface", #"\bhf_[A-Za-z0-9]{30,}\b"#),
            p("privateKey", #"-----BEGIN [A-Z ]*PRIVATE KEY-----[^\x22]*?-----END [A-Z ]*PRIVATE KEY-----"#),
            p("jwt", #"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"#),
            p("databaseUrl", #"(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?)://[^:/\s\x22\\@]+:([^@\s\x22\\]+)@"#, 1),
        ]
    }()

    /// Cuenta las claves de un texto por tipo y, si `redact`, devuelve el texto con ellas tapadas.
    private static func findSecrets(_ text: String, counts: inout [String: Int], redact: Bool) -> String? {
        var current = text
        var changed = false
        for pattern in secrets {
            let ns = current as NSString
            let matches = pattern.regex.matches(in: current, range: NSRange(location: 0, length: ns.length))
            let targets = matches.map { $0.range(at: pattern.group).location == NSNotFound ? $0.range : $0.range(at: pattern.group) }
                .filter { ns.substring(with: $0) != redactedMark }
            guard !targets.isEmpty else { continue }
            counts[pattern.kind, default: 0] += targets.count
            if redact {
                let mutable = NSMutableString(string: current)
                for range in targets.reversed() { mutable.replaceCharacters(in: range, with: redactedMark) }
                current = mutable as String
                changed = true
            }
        }
        return changed ? current : nil
    }

    /// Archivos que hay junto a la sesión (`<id>/`), con su ruta relativa (`subagents/…`).
    private static func sessionFiles(_ session: URL) -> [(url: URL, name: String)] {
        let dir = session.deletingPathExtension()
        guard let enumerator = FileManager.default.enumerator(at: dir, includingPropertiesForKeys: [.isRegularFileKey]) else { return [] }
        let base = dir.standardizedFileURL.path + "/"
        var files: [(URL, String)] = []
        for case let url as URL in enumerator where (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true {
            let path = url.standardizedFileURL.path
            if path.hasPrefix(base) { files.append((url, String(path.dropFirst(base.count)))) }
        }
        return files.sorted { $0.1 < $1.1 }
    }

    private static func isText(_ name: String) -> Bool {
        [".jsonl", ".json", ".txt", ".md", ".log"].contains { name.hasSuffix($0) }
    }

    /// Claves que hay en la sesión (también en sus subagentes y salidas guardadas), por tipo.
    static func scanSecrets(_ session: URL, toolOutput: Bool) -> [String: Int] {
        var counts: [String: Int] = [:]
        func scan(_ url: URL, log: Bool) {
            guard let text = try? String(contentsOf: url, encoding: .utf8) else { return }
            for line in text.split(separator: "\n", omittingEmptySubsequences: true) {
                let line = String(line)
                let body = log && !toolOutput ? stripToolOutput(line) : line
                if let body { _ = findSecrets(body, counts: &counts, redact: false) }
            }
        }
        scan(session, log: true)
        for (url, name) in sessionFiles(session) where isText(name) && (toolOutput || !name.hasPrefix("tool-results/")) {
            scan(url, log: name.hasSuffix(".jsonl"))
        }
        return counts
    }

    // MARK: Exportar

    /// Una línea de la sesión sin lo que devolvieron las herramientas. `nil` = la línea sobra.
    static func stripToolOutput(_ line: String) -> String? {
        guard ["tool_result", "toolUseResult", "api-request"].contains(where: line.contains),
              var object = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any] else { return line }
        // Copias de las peticiones a la API: repiten lo que leyeron las herramientas y Claude Code no
        // las necesita para reanudar.
        if (object["type"] as? String)?.hasPrefix("api-request") == true { return nil }
        if object["toolUseResult"] != nil { object["toolUseResult"] = omitted }
        if var message = object["message"] as? [String: Any], let blocks = message["content"] as? [Any] {
            message["content"] = blocks.map { block -> Any in
                guard var dict = block as? [String: Any], dict["type"] as? String == "tool_result" else { return block }
                dict["content"] = omitted
                return dict
            }
            object["message"] = message
        }
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.withoutEscapingSlashes]) else { return line }
        return String(decoding: data, as: UTF8.self)
    }

    private static func transform(_ text: String, log: Bool, toolOutput: Bool, redact: Bool, counts: inout [String: Int]) -> String {
        var lines: [String] = []
        for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = String(line)
            guard let body = log && !toolOutput && !line.isEmpty ? stripToolOutput(line) : line else { continue }
            lines.append(findSecrets(body, counts: &counts, redact: redact) ?? body)
        }
        return lines.joined(separator: "\n")
    }

    /// `remote.origin.url` de un proyecto, sin usuario ni contraseña.
    static func gitRemote(_ folder: String) -> String? {
        guard let config = try? String(contentsOf: URL(filePath: folder).appending(path: ".git/config"), encoding: .utf8) else { return nil }
        var inOrigin = false
        for raw in config.split(separator: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("[") {
                inOrigin = line == #"[remote "origin"]"#
            } else if inOrigin, line.hasPrefix("url") {
                let value = line.dropFirst(3).trimmingCharacters(in: .whitespaces)
                if value.hasPrefix("=") { return cleanRemote(value.dropFirst().trimmingCharacters(in: .whitespaces)) }
            }
        }
        return nil
    }

    private static func cleanRemote(_ url: String) -> String {
        guard let scheme = url.range(of: "://") else { return url }
        let rest = url[scheme.upperBound...]
        guard let at = rest.firstIndex(of: "@"), !rest[..<at].contains("/") else { return url }
        return String(url[..<scheme.upperBound]) + rest[rest.index(after: at)...]
    }

    /// La misma URL de git escrita de distintas formas queda igual, para compararlas.
    static func normalizeRemote(_ url: String) -> String {
        var value = cleanRemote(url.trimmingCharacters(in: .whitespaces)).lowercased()
        if let scheme = value.range(of: "://") { value = String(value[scheme.upperBound...]) }
        if value.hasPrefix("git@") {
            value = String(value.dropFirst(4))
            if let colon = value.firstIndex(of: ":") { value.replaceSubrange(colon...colon, with: "/") }
        }
        while value.hasSuffix("/") { value.removeLast() }
        if value.hasSuffix(".git") { value.removeLast(4) }
        return value
    }

    /// Crea el paquete `.lap` de una sesión. Devuelve el manifiesto escrito (con las claves tapadas).
    static func export(session: URL, to destination: URL, manifest: Manifest, markdown: String, toolOutput: Bool, redact: Bool) throws -> Manifest {
        let fm = FileManager.default
        var manifest = manifest
        var counts: [String: Int] = [:]
        let text = try String(contentsOf: session, encoding: .utf8)
        let staging = URL.temporaryDirectory.appending(path: "lap-\(UUID().uuidString)", directoryHint: .isDirectory)
        try fm.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: staging) }
        let root = staging.appending(path: "paquete", directoryHint: .isDirectory)
        try fm.createDirectory(at: root, withIntermediateDirectories: true)

        try transform(text, log: true, toolOutput: toolOutput, redact: redact, counts: &counts)
            .write(to: root.appending(path: "session.jsonl"), atomically: false, encoding: .utf8)
        let extra = sessionFiles(session)
        for (url, name) in extra where toolOutput || !name.hasPrefix("tool-results/") {
            let target = root.appending(path: "files/" + name)
            try fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            if isText(name), let content = try? String(contentsOf: url, encoding: .utf8) {
                try transform(content, log: name.hasSuffix(".jsonl"), toolOutput: toolOutput, redact: redact, counts: &counts)
                    .write(to: target, atomically: false, encoding: .utf8)
            } else {
                try fm.copyItem(at: url, to: target)
            }
        }
        var ignored: [String: Int] = [:]
        try (findSecrets(markdown, counts: &ignored, redact: redact) ?? markdown)
            .write(to: root.appending(path: "conversation.md"), atomically: false, encoding: .utf8)

        manifest.format = format
        manifest.os = "macos"
        manifest.toolOutput = toolOutput
        manifest.exportedAt = manifest.exportedAt ?? .now
        if manifest.gitRemote == nil, let cwd = manifest.cwd { manifest.gitRemote = gitRemote(cwd) }
        if !extra.isEmpty { manifest.sourceDir = session.deletingPathExtension().path(percentEncoded: false) }
        manifest.redacted = redact ? counts.values.reduce(0, +) : 0
        try encoder.encode(manifest).write(to: root.appending(path: "manifest.json"))

        let archive = staging.appending(path: "sesion.lap")
        try run("/usr/bin/zip", ["-q", "-r", "-X", "-D", archive.path, "."], in: root)
        if fm.fileExists(atPath: destination.path) { try fm.removeItem(at: destination) }
        try fm.moveItem(at: archive, to: destination)
        return manifest
    }

    // MARK: Importar

    /// Cambia en todos los textos de un valor JSON la carpeta de origen por la nueva.
    private static func rewrite(_ value: Any, from: String, to: String) -> (Any, Bool) {
        switch value {
        case let text as String where text.contains(from):
            var out = ""
            var rest = Substring(text)
            while let range = rest.range(of: from) {
                out += rest[..<range.lowerBound]
                out += to
                rest = rest[range.upperBound...]
                // El resto de la ruta, hasta un espacio o una comilla, con «/».
                let end = rest.firstIndex { $0.isWhitespace || "\"'`)]>,".contains($0) } ?? rest.endIndex
                out += rest[..<end].replacingOccurrences(of: "\\", with: "/")
                rest = rest[end...]
            }
            return (out + rest, true)
        case let array as [Any]:
            var changed = false
            let items = array.map { item -> Any in
                let (new, didChange) = rewrite(item, from: from, to: to)
                changed = changed || didChange
                return new
            }
            return (items, changed)
        case let dict as [String: Any]:
            var changed = false
            var out: [String: Any] = [:]
            for (key, item) in dict {
                let (new, didChange) = rewrite(item, from: from, to: to)
                changed = changed || didChange
                out[key] = new
            }
            return (out, changed)
        default:
            return (value, false)
        }
    }

    private static func rewriteText(_ text: String, from: String, to: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: from, options: [.fragmentsAllowed, .withoutEscapingSlashes]) else { return text }
        let escaped = String(decoding: data, as: UTF8.self).trimmingCharacters(in: CharacterSet(charactersIn: "\""))
        guard text.contains(escaped) else { return text }
        return text.split(separator: "\n", omittingEmptySubsequences: false).map { line -> String in
            let line = String(line)
            guard line.contains(escaped), let object = try? JSONSerialization.jsonObject(with: Data(line.utf8)) else { return line }
            let (new, changed) = rewrite(object, from: from, to: to)
            guard changed, let data = try? JSONSerialization.data(withJSONObject: new, options: [.withoutEscapingSlashes]) else { return line }
            return String(decoding: data, as: UTF8.self)
        }.joined(separator: "\n")
    }

    /// Copia la sesión a la carpeta de proyecto de `folder` dentro de `projects`, con el nombre que usa
    /// Claude Code (`<id>.jsonl`) y sus archivos en `<id>/`. No sobrescribe.
    static func importFile(_ file: URL, into projects: URL, folder: String) throws -> Shared {
        let fm = FileManager.default
        let shared = try inspect(file)
        let id = shared.manifest.sessionId.uuidString.lowercased()
        let destination = projects.appending(path: folder.replacing(/[^A-Za-z0-9]/, with: "-"), directoryHint: .isDirectory)
        let target = destination.appending(path: id + ".jsonl")
        let targetDir = destination.appending(path: id, directoryHint: .isDirectory)
        guard !fm.fileExists(atPath: target.path) else { throw PackageError.alreadyThere }
        try fm.createDirectory(at: destination, withIntermediateDirectories: true)
        guard shared.packaged else {
            try fm.copyItem(at: file, to: target)
            return shared
        }

        // Tamaño y número de archivos antes de descomprimir nada.
        let summary = String(decoding: (try? run("/usr/bin/unzip", ["-Zt", file.path])) ?? Data(), as: UTF8.self)
        let numbers = summary.split(whereSeparator: { !$0.isNumber }).compactMap { Int64($0) }
        guard numbers.count >= 2 else { throw PackageError.damaged }
        guard numbers[0] <= maxEntries, numbers[1] <= maxUnpacked else { throw PackageError.tooBig }

        let staging = URL.temporaryDirectory.appending(path: "lap-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? fm.removeItem(at: staging) }
        // unzip quita los «../» y las rutas absolutas: todo queda dentro de `staging`.
        try run("/usr/bin/unzip", ["-qq", "-o", file.path, "-d", staging.path])

        let newDir = targetDir.path(percentEncoded: false).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let newDirPath = "/" + newDir
        let from = shared.manifest.sourceDir.flatMap { $0 == newDirPath ? nil : $0 }
        func place(_ source: URL, at output: URL, name: String) throws {
            try fm.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
            if let from, isText(name), let text = try? String(contentsOf: source, encoding: .utf8) {
                try rewriteText(text, from: from, to: newDirPath).write(to: output, atomically: false, encoding: .utf8)
            } else {
                try fm.copyItem(at: source, to: output)
            }
        }
        do {
            try place(staging.appending(path: "session.jsonl"), at: target, name: "session.jsonl")
            let files = staging.appending(path: "files", directoryHint: .isDirectory)
            let base = files.standardizedFileURL.path + "/"
            if let enumerator = fm.enumerator(at: files, includingPropertiesForKeys: [.isRegularFileKey]) {
                for case let url as URL in enumerator where (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true {
                    let path = url.standardizedFileURL.path
                    guard path.hasPrefix(base) else { continue }
                    let relative = String(path.dropFirst(base.count))
                    try place(url, at: targetDir.appending(path: relative), name: relative)
                }
            }
        } catch {
            // Sin restos: lo importado a medias se quita.
            try? fm.removeItem(at: target)
            try? fm.removeItem(at: targetDir)
            throw error
        }
        return shared
    }

    /// Carpeta propuesta para importar: la original si existe aquí; si no, una de `known` con el mismo
    /// repositorio de git o, por último, con el mismo nombre.
    static func suggestFolder(_ manifest: Manifest, known: [String]) -> String? {
        let fm = FileManager.default
        if let cwd = manifest.cwd, fm.fileExists(atPath: cwd) { return cwd }
        let existing = known.filter { fm.fileExists(atPath: $0) }
        if let remote = manifest.gitRemote.map(normalizeRemote),
           let found = existing.first(where: { gitRemote($0).map(normalizeRemote) == remote }) {
            return found
        }
        guard let name = manifest.cwd?.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last?.lowercased() else { return nil }
        return existing.first { ($0 as NSString).lastPathComponent.lowercased() == name }
    }
}
