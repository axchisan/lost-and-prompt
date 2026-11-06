import Foundation

/// Una cuenta de Claude Code: una carpeta de configuración (`~/.claude`, `~/.claude-trabajo`, la de
/// `CLAUDE_CONFIG_DIR`…) con sus propias sesiones.
nonisolated struct ClaudeAccount: Identifiable, Hashable, Sendable {
    /// Ruta de la carpeta de configuración; sirve de identificador.
    let id: String
    /// Nombre sacado de la carpeta (`.claude-migozz` → «Migozz»); vacío en la principal.
    let detectedName: String
    /// `~/.claude`: la que usa `claude` sin `CLAUDE_CONFIG_DIR`. Para las demás, el comando de
    /// reanudar antepone la variable.
    let isDefault: Bool

    var configURL: URL { URL(filePath: id, directoryHint: .isDirectory) }
    var projectsURL: URL { configURL.appending(path: "projects", directoryHint: .isDirectory) }
    var settingsURL: URL { configURL.appending(path: "settings.json") }

    /// `CLAUDE_CONFIG_DIR` para reanudar sus sesiones; `nil` en la principal.
    var environmentValue: String? { isDefault ? nil : id }
}

/// Busca las cuentas de Claude Code del equipo. Es el equivalente de `core/src/accounts.rs`.
///
/// Solo se lee: de los archivos del shell, únicamente los valores de `CLAUDE_CONFIG_DIR=`.
nonisolated enum ClaudeAccounts {
    static let shellFiles = [".zshrc", ".zprofile", ".zshenv", ".bashrc", ".bash_profile", ".profile", ".config/fish/config.fish"]

    static var homePath: String { FileManager.default.homeDirectoryForCurrentUser.path(percentEncoded: false).trimmingSuffix("/") }

    static var defaultAccount: ClaudeAccount { ClaudeAccount(id: homePath + "/.claude", detectedName: "", isDefault: true) }

    /// 1. `~/.claude` (siempre); 2. `$CLAUDE_CONFIG_DIR`; 3. carpetas `~/.claude-*` con `projects/`;
    /// 4. valores de `CLAUDE_CONFIG_DIR=` en los archivos del shell; 5. las añadidas a mano.
    /// Salvo la primera, solo cuentan las que tienen carpeta `projects`. Sin repetidas.
    static func detect(extra: [String], home: String = homePath,
                       environment: String? = ProcessInfo.processInfo.environment["CLAUDE_CONFIG_DIR"]) -> [ClaudeAccount] {
        let fm = FileManager.default
        var found = [home + "/.claude"]
        var candidates: [String] = []
        if let environment, !environment.isEmpty { candidates.append(environment) }
        let named = ((try? fm.contentsOfDirectory(atPath: home)) ?? [])
            .filter { $0.hasPrefix(".claude-") || $0.hasPrefix(".claude_") }
            .sorted()
            .map { home + "/" + $0 }
        candidates += named
        for file in shellFiles {
            if let text = try? String(contentsOfFile: home + "/" + file, encoding: .utf8) {
                candidates += configDirs(inShell: text, home: home)
            }
        }
        candidates += extra.map { $0.hasPrefix("~") ? home + $0.dropFirst() : $0 }

        for candidate in candidates {
            let dir = candidate.count > 1 ? candidate.trimmingSuffix("/") : candidate
            var isDirectory: ObjCBool = false
            guard fm.fileExists(atPath: dir + "/projects", isDirectory: &isDirectory), isDirectory.boolValue,
                  !found.contains(where: { sameDirectory($0, dir) }) else { continue }
            found.append(dir)
        }
        return found.map { dir in
            let isDefault = dir == home + "/.claude"
            return ClaudeAccount(id: dir, detectedName: isDefault ? "" : name(for: dir), isDefault: isDefault)
        }
    }

    /// `.claude-migozz` → «Migozz»; `.claude_mi-equipo` → «Mi equipo»; `claude-work` → «Work».
    static func name(for path: String) -> String {
        let folder = (path as NSString).lastPathComponent
        let trimmed = String(folder.drop { $0 == "." })
        var rest = trimmed
        if rest.hasPrefix("claude") { rest = String(rest.dropFirst("claude".count).drop { "-_.".contains($0) }) }
        let base = rest.isEmpty ? trimmed : rest
        let words = String(base.map { "-_.".contains($0) ? " " : $0 }).trimmingCharacters(in: .whitespaces)
        guard let first = words.first else { return folder }
        return first.uppercased() + words.dropFirst()
    }

    /// Valores de `CLAUDE_CONFIG_DIR=` (o `set -x CLAUDE_CONFIG_DIR …` en fish) en un archivo del
    /// shell, con `~`, `$HOME` y `${HOME}` resueltos. Se ignoran los comentarios y los valores que
    /// dependen de otras variables.
    static func configDirs(inShell text: String, home: String) -> [String] {
        let key = "CLAUDE_CONFIG_DIR"
        var result: [String] = []
        for line in text.split(separator: "\n", omittingEmptySubsequences: true) {
            let code = line.drop { $0 == " " || $0 == "\t" }
            if code.hasPrefix("#") { continue }
            var rest = Substring(code)
            while let range = rest.range(of: key) {
                let before = rest[..<range.lowerBound].last
                let after = rest[range.upperBound...]
                rest = after
                if let before, before.isLetter || before.isNumber || before == "_" || before == "$" || before == "{" { continue }
                let value: Substring
                if after.hasPrefix("=") {
                    value = after.dropFirst()
                } else if code.contains("set "), let first = after.first, first == " " || first == "\t" {
                    value = after.drop { $0 == " " || $0 == "\t" }
                } else {
                    continue
                }
                if let dir = shellValue(value, home: home) { result.append(dir) }
            }
        }
        return result
    }

    private static func shellValue(_ value: Substring, home: String) -> String? {
        guard let first = value.first else { return nil }
        var raw: String
        if first == "\"" || first == "'" {
            raw = String(value.dropFirst().prefix { $0 != first })
        } else {
            raw = String(value.prefix { !$0.isWhitespace && $0 != ";" && $0 != ")" && $0 != "`" })
        }
        raw = raw.replacingOccurrences(of: "${HOME}", with: "$HOME")
        if raw.hasPrefix("$HOME") {
            raw = home + raw.dropFirst("$HOME".count)
        } else if raw.hasPrefix("~") {
            raw = home + raw.dropFirst()
        }
        guard !raw.isEmpty, !raw.contains("$"), raw.hasPrefix("/") else { return nil }
        return raw
    }

    /// Misma carpeta aunque se escriba distinto (enlaces simbólicos, mayúsculas).
    private static func sameDirectory(_ a: String, _ b: String) -> Bool {
        if a == b { return true }
        let x = URL(filePath: a).resolvingSymlinksInPath().standardizedFileURL
        let y = URL(filePath: b).resolvingSymlinksInPath().standardizedFileURL
        if x == y { return true }
        let ix = try? x.resourceValues(forKeys: [.fileResourceIdentifierKey]).fileResourceIdentifier as? NSObject
        let iy = try? y.resourceValues(forKeys: [.fileResourceIdentifierKey]).fileResourceIdentifier as? NSObject
        return ix != nil && ix == iy
    }

    /// `CLAUDE_CONFIG_DIR='…' claude …` para las cuentas que no son la principal.
    static func command(_ command: String, account environmentValue: String?) -> String {
        guard let environmentValue else { return command }
        return "CLAUDE_CONFIG_DIR='\(environmentValue.replacingOccurrences(of: "'", with: "'\\''"))' \(command)"
    }
}

private extension String {
    nonisolated func trimmingSuffix(_ suffix: String) -> String {
        var result = self
        while result.count > 1 && result.hasSuffix(suffix) { result.removeLast(suffix.count) }
        return result
    }
}
