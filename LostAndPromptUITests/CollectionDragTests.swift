import XCTest

/// Arrastrar una sesión de la lista a una colección de la barra lateral, con los datos de ejemplo.
final class CollectionDragTests: XCTestCase {
    /// Espera a que el contador de la colección en la barra lateral llegue a `count`.
    private func waitForCount(_ collection: XCUIElement, _ count: String) -> Bool {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", count), object: collection)
        return XCTWaiter().wait(for: [expectation], timeout: 4) == .completed
    }

    func testArrastrarSesionAUnaColeccion() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-LPMock", "YES", "-AppleLanguages", "(es)"]
        app.launch()
        defer { app.terminate() }
        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10))

        let sidebar = window.outlines["Barra lateral"]
        let collection = sidebar.staticTexts["Juegos"]
        XCTAssertTrue(collection.waitForExistence(timeout: 5))
        XCTAssertEqual(collection.value as? String, "1")

        // Una sesión de la lista.
        window.staticTexts["Tema oscuro para el blog"].firstMatch.click(forDuration: 0.8, thenDragTo: collection)
        XCTAssertTrue(waitForCount(collection, "2"), "la sesión arrastrada entra en la colección")
    }
}
