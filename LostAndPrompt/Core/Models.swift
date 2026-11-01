import AppKit

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
    var isArchived: Bool = false
    /// Colecciones a las que se añadió la sesión.
    var collectionIDs: [SessionCollection.ID] = []
    /// Colecciones que incluyen la carpeta de la sesión (o una carpeta que la contiene).
    var folderCollectionIDs: [SessionCollection.ID] = []

    /// Todas sus colecciones, por sí misma o por su carpeta.
    var allCollectionIDs: [SessionCollection.ID] { collectionIDs + folderCollectionIDs.filter { !collectionIDs.contains($0) } }

    func isIn(_ collection: SessionCollection.ID) -> Bool {
        collectionIDs.contains(collection) || folderCollectionIDs.contains(collection)
    }
    var firstPrompt: String
    var lastReply: String?
    var folderExists: Bool = true
    var note: String?
    /// Archivo `.jsonl` de la sesión; `nil` en los datos de ejemplo.
    var filePath: String?

    var title: String { customTitle ?? aiTitle }

    /// Del primer al último mensaje («1 h 20 min», «3 d»); nil si duró menos de un minuto.
    var durationText: String? {
        let seconds = lastActivity.timeIntervalSince(startedAt)
        guard seconds >= 60 else { return nil }
        let formatter = DateComponentsFormatter()
        formatter.unitsStyle = .abbreviated
        formatter.allowedUnits = seconds >= 86_400 ? [.day, .hour] : [.hour, .minute]
        formatter.maximumUnitCount = 2
        return formatter.string(from: seconds)
    }

    static let homePath = NSHomeDirectory()

    var isInHome: Bool { cwd == Self.homePath }

    /// Nombre corto de la carpeta; el directorio de inicio se llama «Inicio».
    var folderName: String {
        isInHome ? String(localized: "Inicio") : (cwd as NSString).lastPathComponent
    }

    /// Ruta con `~` en lugar del directorio de inicio.
    var abbreviatedPath: String { Self.abbreviate(cwd) }

    /// La ruta con `~` en lugar de la carpeta personal.
    static func abbreviate(_ path: String) -> String {
        path.hasPrefix(homePath) ? "~" + path.dropFirst(homePath.count) : path
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
    /// Razonamiento de Claude (bloque `thinking`); solo se ve si se activa en «Mostrar».
    var isThinking = false
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
    case archived
    case collection(SessionCollection.ID)
    case project(String)
}

/// Periodo del filtro de la lista, contado hacia atrás desde hoy.
enum DatePeriod: String, CaseIterable, Identifiable {
    case all, today, week, month, quarter
    var id: Self { self }

    var title: String {
        switch self {
        case .all: String(localized: "Cualquier fecha")
        case .today: String(localized: "Hoy")
        case .week: String(localized: "Últimos 7 días")
        case .month: String(localized: "Últimos 30 días")
        case .quarter: String(localized: "Últimos 3 meses")
        }
    }

    /// Fecha desde la que se muestran sesiones (nil = todas).
    func start(from now: Date) -> Date? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        switch self {
        case .all: return nil
        case .today: return today
        case .week: return calendar.date(byAdding: .day, value: -6, to: today)
        case .month: return calendar.date(byAdding: .day, value: -29, to: today)
        case .quarter: return calendar.date(byAdding: .month, value: -3, to: today)
        }
    }
}

enum SessionListStyle: String, CaseIterable, Identifiable {
    case rows, cards
    var id: Self { self }
}

enum TerminalApp: String, CaseIterable, Identifiable {
    case warp, terminal, iterm, ghostty, wezterm, kitty, alacritty, custom
    var id: Self { self }

    var displayName: String {
        switch self {
        case .warp: "Warp"
        case .terminal: "Terminal"
        case .iterm: "iTerm2"
        case .ghostty: "Ghostty"
        case .wezterm: "WezTerm"
        case .kitty: "Kitty"
        case .alacritty: "Alacritty"
        case .custom: String(localized: "Personalizada…")
        }
    }

    /// Nombre para «Reanudar en …».
    var resumeName: String { self == .custom ? String(localized: "tu terminal") : displayName }

    /// Identificador de la app en macOS (`nil` para la opción personalizada).
    var bundleID: String? {
        switch self {
        case .warp: "dev.warp.Warp-Stable"
        case .terminal: "com.apple.Terminal"
        case .iterm: "com.googlecode.iterm2"
        case .ghostty: "com.mitchellh.ghostty"
        case .wezterm: "com.github.wez.wezterm"
        case .kitty: "net.kovidgoyal.kitty"
        case .alacritty: "org.alacritty"
        case .custom: nil
        }
    }

    var isInstalled: Bool {
        guard let bundleID else { return true }
        return NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) != nil
    }

    /// Las instaladas y la personalizada, en el orden de la lista.
    static var available: [TerminalApp] { allCases.filter(\.isInstalled) }
}

/// Editor de código donde abrir la carpeta de una sesión.
enum EditorApp: String, CaseIterable, Identifiable {
    case vscode, cursor, windsurf, zed, sublime, nova, xcode, intellij, webstorm, pycharm
    var id: Self { self }

    var displayName: String {
        switch self {
        case .vscode: "Visual Studio Code"
        case .cursor: "Cursor"
        case .windsurf: "Windsurf"
        case .zed: "Zed"
        case .sublime: "Sublime Text"
        case .nova: "Nova"
        case .xcode: "Xcode"
        case .intellij: "IntelliJ IDEA"
        case .webstorm: "WebStorm"
        case .pycharm: "PyCharm"
        }
    }

    /// Nombre corto para «Abrir en …».
    var shortName: String { self == .vscode ? "VS Code" : displayName }

    /// Identificadores posibles en macOS (ediciones estable, Community, etc.).
    var bundleIDs: [String] {
        switch self {
        case .vscode: ["com.microsoft.VSCode", "com.microsoft.VSCodeInsiders"]
        case .cursor: ["com.todesktop.230313mzl4w4u92"]
        case .windsurf: ["com.exafunction.windsurf"]
        case .zed: ["dev.zed.Zed", "dev.zed.Zed-Preview"]
        case .sublime: ["com.sublimetext.4", "com.sublimetext.3"]
        case .nova: ["com.panic.Nova"]
        case .xcode: ["com.apple.dt.Xcode"]
        case .intellij: ["com.jetbrains.intellij", "com.jetbrains.intellij.ce"]
        case .webstorm: ["com.jetbrains.WebStorm"]
        case .pycharm: ["com.jetbrains.pycharm", "com.jetbrains.pycharm.ce"]
        }
    }

    var appURL: URL? { bundleIDs.lazy.compactMap { NSWorkspace.shared.urlForApplication(withBundleIdentifier: $0) }.first }

    static var available: [EditorApp] { allCases.filter { $0.appURL != nil } }
}
