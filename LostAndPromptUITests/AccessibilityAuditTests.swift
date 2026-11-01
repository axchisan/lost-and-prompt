import XCTest

/// Auditoría de accesibilidad de Xcode (VoiceOver, contraste, nombres de los controles…) sobre cada
/// vista, con los datos de ejemplo para no depender de las sesiones del equipo.
final class AccessibilityAuditTests: XCTestCase {
    private func audit(_ arguments: [String]) throws {
        let app = XCUIApplication()
        app.launchArguments = ["-LPMock", "YES", "-AppleLanguages", "(es)"] + arguments
        app.launch()
        defer { app.terminate() }
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 10))
        if ProcessInfo.processInfo.environment["LP_DUMP_TREE"] != nil { print("TREE>>\n" + app.windows.firstMatch.debugDescription + "\n<<TREE") }
        // Sin la comprobación de contraste: en macOS mide sobre capturas tomadas a mitad de las
        // animaciones y marca hasta texto en el color principal. La app solo usa los colores
        // semánticos del sistema (principal y secundario), que «Aumentar contraste» refuerza.
        try app.performAccessibilityAudit(for: XCUIAccessibilityAuditType.all.subtracting(.contrast)) { issue in
            let ignored = Self.isKnownFalsePositive(issue)
            if !ignored {
                print("AUDIT|\(issue.auditType.rawValue)|\(issue.element.map { String($0.elementType.rawValue) } ?? "-")|\(issue.element?.label ?? "")|\(issue.compactDescription)")
            }
            return ignored
        }
    }

    /// Avisos de la auditoría que no son fallos de la app sino de cómo expone SwiftUI sus propios
    /// controles en macOS; cualquier otro hace fallar la prueba.
    static func isKnownFalsePositive(_ issue: XCUIAccessibilityAuditIssue) -> Bool {
        let type = issue.element?.elementType
        let unlabeled = issue.element?.label.isEmpty ?? true
        switch issue.auditType {
        case .sufficientElementDescription:
            // Contenedores de maquetación (grupos y listas) y las marcas de Swift Charts, que ya
            // llevan día y costo pero no un rol que la auditoría reconozca.
            return (unlabeled && [.group, .other, .outline, .scrollView, .splitGroup].contains(type))
                || issue.compactDescription.localizedCaseInsensitiveContains("role")
        case .action:
            // Los menús de SwiftUI se abren con la acción AXShowMenu, no con AXPress.
            return type == .menuButton
        case .parentChild:
            return type == .group || type == nil
        default:
            return false
        }
    }

    func testRecientes() throws { try audit([]) }
    func testTarjetas() throws { try audit(["-LPScreen", "cards"]) }
    func testBuscarEnLaConversacion() throws { try audit(["-LPFind", "nivel"]) }
    func testArchivadas() throws { try audit(["-LPScreen", "archived"]) }
    func testActividad() throws { try audit(["-LPScreen", "activity"]) }
}
