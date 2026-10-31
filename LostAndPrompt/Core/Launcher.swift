import AppKit

/// Abre una sesión de Claude Code en la terminal elegida, en su carpeta original.
enum Launcher {
    enum LaunchError: LocalizedError {
        case missingFolder(String)
        case terminalNotInstalled(String)
        case emptyTemplate

        var errorDescription: String? {
            switch self {
            case .missingFolder(let path): String(localized: "La carpeta «\(path)» ya no existe.")
            case .terminalNotInstalled(let name): String(localized: "\(name) no está instalada.")
            case .emptyTemplate: String(localized: "Escribe el comando de tu terminal en Ajustes → General.")
            }
        }
    }

    static func resume(_ session: Session, in terminal: TerminalApp, extraArguments: String, customTemplate: String = "") throws {
        guard FileManager.default.fileExists(atPath: session.cwd) else { throw LaunchError.missingFolder(session.abbreviatedPath) }
        let arguments = extraArguments.trimmingCharacters(in: .whitespaces)
        let command = "claude --resume \(session.id.uuidString.lowercased())" + (arguments.isEmpty ? "" : " " + arguments)

        switch terminal {
        case .warp: try openInWarp(cwd: session.cwd, command: command, title: session.title)
        case .terminal: try openScript(cwd: session.cwd, command: command, bundleID: "com.apple.Terminal", name: "Terminal")
        case .iterm: try openScript(cwd: session.cwd, command: command, bundleID: "com.googlecode.iterm2", name: "iTerm2")
        case .ghostty: try openInGhostty(cwd: session.cwd, command: command)
        case .wezterm: try openApp("WezTerm", bundleID: "com.github.wez.wezterm", ["start", "--cwd", session.cwd, "--", "/bin/zsh", "-lc", command])
        case .kitty: try openApp("Kitty", bundleID: "net.kovidgoyal.kitty", ["--directory", session.cwd, "/bin/zsh", "-lc", command + "; exec zsh"])
        case .alacritty: try openApp("Alacritty", bundleID: "org.alacritty", ["--working-directory", session.cwd, "-e", "/bin/zsh", "-lc", command + "; exec zsh"])
        case .custom: try runTemplate(customTemplate, cwd: session.cwd, command: command)
        }
    }

    static func revealInFinder(_ session: Session) {
        NSWorkspace.shared.activateFileViewerSelecting([URL(filePath: session.cwd)])
    }

    // MARK: Warp

    /// Warp ejecuta comandos al abrir una Tab Config (`~/.warp/tab_configs/*.toml`).
    private static func openInWarp(cwd: String, command: String, title: String) throws {
        guard NSWorkspace.shared.urlForApplication(withBundleIdentifier: "dev.warp.Warp-Stable") != nil else {
            throw LaunchError.terminalNotInstalled("Warp")
        }
        let folder = FileManager.default.homeDirectoryForCurrentUser.appending(path: ".warp/tab_configs", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let config = """
        # Generado por Lost & Prompt: se reescribe en cada reanudación.
        name = "Lost & Prompt"
        title = \(toml(title))

        [[panes]]
        id = "main"
        type = "terminal"
        directory = \(toml(cwd))
        commands = [\(toml(command))]

        """
        try config.write(to: folder.appending(path: "lost_and_prompt.toml"), atomically: true, encoding: .utf8)
        NSWorkspace.shared.open(URL(string: "warp://tab_config/lost_and_prompt")!)
    }

    private static func toml(_ value: String) -> String {
        "\"" + value.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") + "\""
    }

    // MARK: Terminal e iTerm2

    private static func openScript(cwd: String, command: String, bundleID: String, name: String) throws {
        guard let app = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
            throw LaunchError.terminalNotInstalled(name)
        }
        let script = URL.temporaryDirectory.appending(path: "lost-and-prompt-\(UUID().uuidString.prefix(8)).command")
        try "#!/bin/zsh -l\ncd \(shell(cwd)) && \(command)\n".write(to: script, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: script.path)
        NSWorkspace.shared.open([script], withApplicationAt: app, configuration: NSWorkspace.OpenConfiguration())
    }

    // MARK: Ghostty

    private static func openInGhostty(cwd: String, command: String) throws {
        guard NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.mitchellh.ghostty") != nil else {
            throw LaunchError.terminalNotInstalled("Ghostty")
        }
        let process = Process()
        process.executableURL = URL(filePath: "/usr/bin/open")
        process.arguments = ["-na", "Ghostty", "--args", "--working-directory=\(cwd)", "-e", "/bin/zsh", "-lc", command]
        try process.run()
    }

    /// Abre una instancia nueva de la app con argumentos (`open -na`).
    private static func openApp(_ name: String, bundleID: String, _ arguments: [String]) throws {
        guard NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) != nil else {
            throw LaunchError.terminalNotInstalled(name)
        }
        let process = Process()
        process.executableURL = URL(filePath: "/usr/bin/open")
        process.arguments = ["-nb", bundleID, "--args"] + arguments
        try process.run()
    }

    /// Plantilla del usuario: `{cwd}` es la carpeta (entre comillas) y `{command}` el comando de Claude Code.
    private static func runTemplate(_ template: String, cwd: String, command: String) throws {
        guard !template.trimmingCharacters(in: .whitespaces).isEmpty else { throw LaunchError.emptyTemplate }
        let line = template.replacingOccurrences(of: "{cwd}", with: shell(cwd)).replacingOccurrences(of: "{command}", with: command)
        let process = Process()
        process.executableURL = URL(filePath: "/bin/zsh")
        process.arguments = ["-lc", line]
        process.currentDirectoryURL = URL(filePath: cwd)
        try process.run()
    }

    private static func shell(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
