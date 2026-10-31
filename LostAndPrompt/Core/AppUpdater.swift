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
