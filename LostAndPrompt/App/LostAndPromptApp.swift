import SwiftUI

@main
struct LostAndPromptApp: App {
    @State private var model = LostAndPromptApp.makeModel()
    @State private var updater = AppUpdater()
    @AppStorage("showMenuBarExtra") private var showMenuBarExtra = true

    var body: some Scene {
        Window("Lost & Prompt", id: "main") {
            MainView()
                .environment(model)
                .onAppear(perform: applyLaunchOptions)
                .task { await model.reload() }
                .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
                    Task { await model.reload() }
                }
        }
        .defaultSize(width: 1180, height: 740)
        .commands {
            AppCommands(model: model)
            CommandGroup(after: .appInfo) {
                Button("Buscar actualizaciones…") { updater.checkForUpdates() }
                    .disabled(!updater.isAvailable)
            }
        }

        Settings {
            SettingsView().environment(model).environment(updater)
        }

        MenuBarExtra("Lost & Prompt", systemImage: "shippingbox", isInserted: $showMenuBarExtra) {
            MenuBarView().environment(model)
        }
        .menuBarExtraStyle(.window)
    }

    /// Datos reales por defecto; `-LPMock YES` (o cualquier `-LPScreen`) usa los de ejemplo para capturas.
    private static func makeModel() -> AppModel {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: "LPMock") || defaults.string(forKey: "LPScreen") != nil else { return .live() }
        let model = MockData.model()
        switch defaults.string(forKey: "LPScreen") {
        case "cards": model.listStyle = .cards
        case "favorites": model.sidebarSelection = .favorites
        case "activity": model.sidebarSelection = .activity
        case "quickopen": model.isQuickOpenPresented = true
        case "empty":
            model.sidebarSelection = .favorites
            for index in model.sessions.indices { model.sessions[index].isFavorite = false }
        case "search": model.searchText = "acme"
        case "missing":
            if let index = model.sessions.firstIndex(where: { $0.id == MockData.featuredID }) {
                model.sessions[index].folderExists = false
            }
        default: break
        }
        return model
    }

    /// Opciones para capturas: `-LPDark YES` fuerza el modo oscuro y `-LPFind <texto>` abre ⌘F con ese texto.
    private func applyLaunchOptions() {
        let defaults = UserDefaults.standard
        if let find = defaults.string(forKey: "LPFind") {
            model.isFindPresented = true
            model.findText = find
        }
        if defaults.object(forKey: "LPDark") != nil {
            NSApp.appearance = NSAppearance(named: defaults.bool(forKey: "LPDark") ? .darkAqua : .aqua)
        } else {
            AppAppearance.saved.apply()
        }
    }
}

struct AppCommands: Commands {
    var model: AppModel

    var body: some Commands {
        CommandMenu("Sesión") {
            Button("Buscar rápido…") { model.isQuickOpenPresented.toggle() }
                .keyboardShortcut("k")
            Divider()
            Button("Reanudar en \(model.terminal.resumeName)") { if let s = model.selectedSession { model.resume(s) } }
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(model.selectedSession == nil)
            Button("Copiar comando") { if let s = model.selectedSession { model.copyResumeCommand(s) } }
                .keyboardShortcut("c", modifiers: [.command, .shift])
                .disabled(model.selectedSession == nil)
            Button("Favorito") { if let id = model.selectedSessionID { model.toggleFavorite(id) } }
                .keyboardShortcut("d")
                .disabled(model.selectedSession == nil)
            Button("Renombrar…") { model.renamingSession = model.selectedSession }
                .disabled(model.selectedSession == nil)
            Divider()
            if let editor = model.editor {
                Button("Abrir en \(editor.shortName)") { if let s = model.selectedSession { model.openInEditor(s.cwd) } }
                    .keyboardShortcut("o", modifiers: [.command, .shift])
                    .disabled(model.selectedSession?.folderExists != true)
            }
            Button("Mostrar en Finder") { if let s = model.selectedSession { model.revealInFinder(s) } }
                .keyboardShortcut("r", modifiers: [.command, .option])
                .disabled(model.selectedSession == nil)
        }
        CommandGroup(after: .textEditing) {
            Divider()
            Button("Buscar en la conversación…") { model.showFind() }
                .keyboardShortcut("f")
                .disabled(model.selectedSession == nil)
            Button("Siguiente coincidencia") { model.moveFind(by: 1) }
                .keyboardShortcut("g")
                .disabled(!model.isFindPresented || model.findTotal == 0)
            Button("Coincidencia anterior") { model.moveFind(by: -1) }
                .keyboardShortcut("g", modifiers: [.command, .shift])
                .disabled(!model.isFindPresented || model.findTotal == 0)
        }
        CommandGroup(after: .newItem) {
            Button("Nueva sesión en esta carpeta") { if let s = model.selectedSession { model.startNewSession(in: s.cwd) } }
                .keyboardShortcut("n")
                .disabled(model.selectedSession?.folderExists != true)
            Button("Nueva colección…") { model.isCreatingCollection = true }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            Button("Volver a leer las sesiones") { Task { await model.reload() } }
                .keyboardShortcut("r")
        }
        CommandGroup(after: .toolbar) {
            Picker("Vista", selection: Binding(get: { model.listStyle }, set: { model.listStyle = $0 })) {
                Text("Filas").tag(SessionListStyle.rows).keyboardShortcut("1")
                Text("Tarjetas").tag(SessionListStyle.cards).keyboardShortcut("2")
            }
            .pickerStyle(.inline)
        }
    }
}
