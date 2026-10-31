import AppKit

/// Tema de la app, independiente del sistema si se quiere.
enum AppAppearance: String {
    case system, light, dark

    static let key = "appearance"

    static var saved: AppAppearance {
        UserDefaults.standard.string(forKey: key).flatMap(AppAppearance.init) ?? .system
    }

    func apply() {
        switch self {
        case .system: NSApp.appearance = nil
        case .light: NSApp.appearance = NSAppearance(named: .aqua)
        case .dark: NSApp.appearance = NSAppearance(named: .darkAqua)
        }
    }
}

/// Idioma de la app. macOS lo lee de `AppleLanguages` al arrancar, así que cambiarlo
/// requiere reiniciar la app.
enum AppLanguage: String {
    case system, spanish = "es", english = "en"

    static var current: AppLanguage {
        guard let languages = UserDefaults.standard.persistentDomain(forName: Bundle.main.bundleIdentifier ?? "")?["AppleLanguages"] as? [String],
              let first = languages.first else { return .system }
        return first.hasPrefix("en") ? .english : first.hasPrefix("es") ? .spanish : .system
    }

    func save() {
        if self == .system {
            UserDefaults.standard.removeObject(forKey: "AppleLanguages")
        } else {
            UserDefaults.standard.set([rawValue], forKey: "AppleLanguages")
        }
    }

    static func relaunch() {
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.createsNewApplicationInstance = true
        NSWorkspace.shared.openApplication(at: Bundle.main.bundleURL, configuration: configuration) { _, _ in
            DispatchQueue.main.async { NSApp.terminate(nil) }
        }
    }
}
