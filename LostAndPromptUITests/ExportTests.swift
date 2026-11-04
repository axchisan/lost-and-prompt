import AppKit
import XCTest

/// Exportar la conversación desde el menú «Más», con los datos de ejemplo.
final class ExportTests: XCTestCase {
    func testCopiarComoMarkdown() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-LPMock", "YES", "-AppleLanguages", "(es)"]
        app.launch()
        defer { app.terminate() }
        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10))
        NSPasteboard.general.clearContents()

        let more = window.menuButtons["Más acciones"].firstMatch
        XCTAssertTrue(more.waitForExistence(timeout: 5))
        more.click()
        let export = window.menuItems["Exportar"].firstMatch
        XCTAssertTrue(export.waitForExistence(timeout: 3))
        export.hover()
        for item in ["Exportar como Markdown…", "Compartir conversación…", "Exportar para continuar en Claude Code…"] {
            XCTAssertTrue(window.menuItems[item].firstMatch.waitForExistence(timeout: 3), item)
        }
        window.menuItems["Copiar como Markdown"].firstMatch.click()

        let deadline = Date.now.addingTimeInterval(4)
        var text = ""
        while Date.now < deadline {
            text = NSPasteboard.general.string(forType: .string) ?? ""
            if !text.isEmpty { break }
            RunLoop.current.run(until: .now.addingTimeInterval(0.2))
        }
        XCTAssertTrue(text.hasPrefix("# "), text)
        XCTAssertTrue(text.contains("### Tú · "), text)
        XCTAssertTrue(text.contains("Exportada con Lost & Prompt"), text)
        let attachment = XCTAttachment(string: text)
        attachment.lifetime = .keepAlways
        add(attachment)
        print("MARKDOWN>>>\n\(text.prefix(900))\n<<<MARKDOWN")
    }
}
