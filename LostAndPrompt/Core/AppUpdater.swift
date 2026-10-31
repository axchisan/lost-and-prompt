import Sparkle
import SwiftUI

/// Actualizaciones automáticas con Sparkle. Solo arranca si la app trae clave pública
/// (`SPARKLE_PUBLIC_KEY`); las compilaciones de desarrollo no buscan actualizaciones.
@Observable
final class AppUpdater {
    private let controller: SPUStandardUpdaterController?

    static var isConfigured: Bool {
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPublicEDKey") as? String ?? ""
        return !key.isEmpty && !UserDefaults.standard.bool(forKey: "LPMock") && UserDefaults.standard.string(forKey: "LPScreen") == nil
    }

    init() {
        controller = Self.isConfigured
            ? SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
            : nil
        // Sparkle por sí solo mira como mucho una vez cada 24 horas, y no al abrir: una versión
        // publicada justo después de su última comprobación tardaba hasta un día en aparecer.
        // Como en Windows y Linux, se comprueba también al arrancar (sin aviso si no hay nada).
        if let updater = controller?.updater, updater.automaticallyChecksForUpdates {
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) { updater.checkForUpdatesInBackground() }
        }
    }

    var isAvailable: Bool { controller != nil }

    var automaticallyChecks: Bool {
        get { controller?.updater.automaticallyChecksForUpdates ?? false }
        set { controller?.updater.automaticallyChecksForUpdates = newValue }
    }

    func checkForUpdates() {
        controller?.checkForUpdates(nil)
    }
}
