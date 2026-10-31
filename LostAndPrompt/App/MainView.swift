import SwiftUI

struct MainView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openSettings) private var openSettings
    @AppStorage("didShowWelcome") private var didShowWelcome = false

    var body: some View {
        @Bindable var model = model
        Group {
            if model.sidebarSelection == .activity {
                NavigationSplitView {
                    SidebarView()
                } detail: {
                    ActivityView()
                }
            } else if model.listStyle == .cards {
                NavigationSplitView {
                    SidebarView()
                } detail: {
                    SessionCardsView()
                        .inspector(isPresented: .constant(model.selectedSession != nil)) {
                            if let session = model.selectedSession {
                                SessionDetailView(session: session)
                                    .inspectorColumnWidth(min: 400, ideal: 480, max: 600)
                            }
                        }
                        .toolbar { listStylePicker }
                }
            } else {
                NavigationSplitView {
                    SidebarView()
                } content: {
                    SessionListView()
                        .toolbar { listStylePicker }
                } detail: {
                    if let session = model.selectedSession {
                        SessionDetailView(session: session)
                    } else {
                        ContentUnavailableView("Elige una sesión", systemImage: "bubble.left.and.text.bubble.right",
                                               description: Text("Pulsa ⌘K para buscar en todas tus sesiones."))
                    }
                }
            }
        }
        .searchable(text: $model.searchText, placement: .sidebar, prompt: "Buscar")
        .onAppear {
            // Solo para capturas: `-LPScreen settings` abre Ajustes al arrancar.
            if UserDefaults.standard.string(forKey: "LPScreen") == "settings" { openSettings() }
        }
        .sheet(item: $model.renamingSession) { session in
            RenameSheet(session: session)
        }
        .sheet(isPresented: $model.isCreatingCollection) {
            NewCollectionSheet()
        }
        .sheet(item: $model.editingNoteFor) { session in
            NoteSheet(session: session)
        }
        .sheet(isPresented: Binding(get: { model.usesRealData && !didShowWelcome }, set: { if !$0 { didShowWelcome = true } })) {
            WelcomeSheet()
        }
        .alert("No se pudo completar la acción", isPresented: Binding(
            get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("Aceptar", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
        .overlay {
            if model.isQuickOpenPresented {
                ZStack {
                    Color.black.opacity(0.15).ignoresSafeArea()
                        .onTapGesture { model.isQuickOpenPresented = false }
                    QuickOpenView()
                }
                .onKeyPress(.escape) { model.isQuickOpenPresented = false; return .handled }
            }
        }
    }

    private var listStylePicker: some ToolbarContent {
        @Bindable var model = model
        return ToolbarItem(placement: .navigation) {
            Picker("Vista", selection: $model.listStyle) {
                Label("Filas", systemImage: "list.bullet").tag(SessionListStyle.rows)
                Label("Tarjetas", systemImage: "square.grid.2x2").tag(SessionListStyle.cards)
            }
            .pickerStyle(.segmented)
            .help("Cambiar entre filas y tarjetas")
        }
    }
}

#Preview("Clásica") {
    MainView().environment(MockData.model()).frame(width: 1180, height: 740)
}

#Preview("Tarjetas") {
    let model = MockData.model()
    model.listStyle = .cards
    return MainView().environment(model).frame(width: 1280, height: 760)
}
