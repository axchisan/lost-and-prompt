import OSLog
import Sparkle
import SwiftUI

/// Actualizaciones automáticas con Sparkle. Solo arranca si la app trae clave pública
/// (`SPARKLE_PUBLIC_KEY`); las compilaciones de desarrollo no buscan actualizaciones.
@Observable
final class AppUpdater {
    private let controller: SPUStandardUpdaterController?
    @ObservationIgnored private let reporter = UpdateReporter()

    static var isConfigured: Bool {
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPublicEDKey") as? String ?? ""
        return !key.isEmpty && !UserDefaults.standard.bool(forKey: "LPMock") && UserDefaults.standard.string(forKey: "LPScreen") == nil
    }

    init() {
        controller = Self.isConfigured
            ? SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: reporter, userDriverDelegate: reporter)
            : nil
        reporter.showInFocus = { [weak controller] in controller?.checkForUpdates(nil) }
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

/// Muestra las versiones nuevas que encuentra una comprobación automática y deja en el registro del
/// sistema (categoría «updates») qué decide Sparkle: `/usr/bin/log show --predicate 'category == "updates"'`.
///
/// Sparkle aplaza el aviso de una comprobación automática cuando cree que no es buen momento
/// («sin foco inmediato») y espera a que el usuario «vuelva» a la app; en la práctica no llegaba a
/// salir. Con los recordatorios suaves de Sparkle, en ese caso la app lo muestra ella misma: al
/// momento si está delante, o la próxima vez que se active.
private final class UpdateReporter: NSObject, SPUUpdaterDelegate, SPUStandardUserDriverDelegate {
    private let log = Logger(subsystem: Bundle.main.bundleIdentifier ?? "LostAndPrompt", category: "updates")
    /// Abre el aviso en primer plano (una comprobación pedida por el usuario).
    var showInFocus: () -> Void = {}
    private var waitingForActivation: NSObjectProtocol?

    var supportsGentleScheduledUpdateReminders: Bool { true }

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        log.notice("Versión nueva encontrada: \(item.displayVersionString, privacy: .public) (\(item.versionString, privacy: .public))")
    }

    func updaterDidNotFindUpdate(_ updater: SPUUpdater, error: any Error) {
        let reason = (error as NSError).userInfo[SPUNoUpdateFoundReasonKey] as? Int ?? -1
        log.notice("Sin versión nueva (motivo \(reason, privacy: .public)): \(error.localizedDescription, privacy: .public)")
    }

    func updater(_ updater: SPUUpdater, didAbortWithError error: any Error) {
        log.error("Comprobación interrumpida: \(error.localizedDescription, privacy: .public)")
    }

    func standardUserDriverShouldHandleShowingScheduledUpdate(_ update: SUAppcastItem, andInImmediateFocus immediateFocus: Bool) -> Bool {
        log.notice("Aviso programado de \(update.displayVersionString, privacy: .public); foco inmediato: \(immediateFocus, privacy: .public)")
        return immediateFocus
    }

    func standardUserDriverWillHandleShowingUpdate(_ handleShowingUpdate: Bool, forUpdate update: SUAppcastItem, state: SPUUserUpdateState) {
        log.notice("Aviso de \(update.displayVersionString, privacy: .public); lo muestra Sparkle: \(handleShowingUpdate, privacy: .public); pedido por el usuario: \(state.userInitiated, privacy: .public)")
        guard !handleShowingUpdate else { return }
        if NSApp.isActive {
            DispatchQueue.main.async { self.showInFocus() }
        } else if waitingForActivation == nil {
            waitingForActivation = NotificationCenter.default.addObserver(
                forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                guard let self else { return }
                if let token = self.waitingForActivation { NotificationCenter.default.removeObserver(token) }
                self.waitingForActivation = nil
                self.showInFocus()
            }
        }
    }

    func standardUserDriverWillFinishUpdateSession() {
        if let token = waitingForActivation { NotificationCenter.default.removeObserver(token) }
        waitingForActivation = nil
    }
}
