import Foundation

/// Una sesión de Claude Code, tal como la muestra la app.
struct Session: Identifiable, Hashable {
    let id: UUID
    var aiTitle: String
    var customTitle: String?
    /// Directorio donde se abrió la sesión (`cwd` del primer mensaje).
    var cwd: String
    var gitBranch: String?
    var startedAt: Date
    var lastActivity: Date
    var userMessages: Int
    var totalMessages: Int
    var costUSD: Double?
    var model: String
    var isFavorite: Bool = false
    var collectionIDs: [SessionCollection.ID] = []
    var firstPrompt: String
    var lastReply: String?
    var folderExists: Bool = true
    var note: String?
    /// Archivo `.jsonl` de la sesión; `nil` en los datos de ejemplo.
    var filePath: String?

    var title: String { customTitle ?? aiTitle }

    static let homePath = NSHomeDirectory()

    var isInHome: Bool { cwd == Self.homePath }

    /// Nombre corto de la carpeta; el directorio de inicio se llama «Inicio».
    var folderName: String {
        isInHome ? String(localized: "Inicio") : (cwd as NSString).lastPathComponent
    }

    /// Ruta con `~` en lugar del directorio de inicio.
    var abbreviatedPath: String {
        cwd.hasPrefix(Self.homePath) ? "~" + cwd.dropFirst(Self.homePath.count) : cwd
    }

    var resumeCommand: String {
        "cd '\(cwd)' && claude --resume \(id.uuidString.lowercased())"
    }
}

struct SessionCollection: Identifiable, Hashable {
    let id: String
    var name: String
    var tint: Tint
    var symbol: String = "folder"

    /// Colores de etiqueta, los mismos que usa Finder.
    enum Tint: String, CaseIterable, Hashable {
        case red, orange, yellow, green, teal, blue, indigo, purple, gray
    }
}

nonisolated struct Message: Identifiable, Hashable, Sendable {
    enum Role: Hashable, Sendable { case user, assistant }

    let id = UUID()
    var role: Role
    var date: Date
    var text: String
    var toolCount: Int = 0
}

/// Nodo del árbol de carpetas de la barra lateral.
struct ProjectNode: Identifiable, Hashable {
    var id: String { path }
    var path: String
    var name: String
    var sessionCount: Int
    var children: [ProjectNode]?
}

enum SidebarItem: Hashable {
    case recents
    case favorites
    case activity
    case collection(SessionCollection.ID)
    case project(String)
}

enum SessionListStyle: String, CaseIterable, Identifiable {
    case rows, cards
    var id: Self { self }
}

enum TerminalApp: String, CaseIterable, Identifiable {
    case warp, terminal, iterm, ghostty
    var id: Self { self }

    var displayName: String {
        switch self {
        case .warp: "Warp"
        case .terminal: "Terminal"
        case .iterm: "iTerm2"
        case .ghostty: "Ghostty"
        }
    }
}
