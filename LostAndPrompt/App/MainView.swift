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
                        .toolbar { listStylePicker; filterMenu }
                }
            } else {
                NavigationSplitView {
                    SidebarView()
                } content: {
                    SessionListView()
                        .toolbar { listStylePicker; filterMenu }
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

    private var filterMenu: some ToolbarContent {
        @Bindable var model = model
        return ToolbarItem(placement: .navigation) {
            Menu {
                Picker("Fecha", selection: $model.filterPeriod) {
                    ForEach(DatePeriod.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.inline)
                Toggle("Solo favoritos", isOn: $model.filterFavoritesOnly)
                if !model.branches.isEmpty {
                    Picker("Rama de git", selection: $model.filterBranch) {
                        Text("Cualquier rama").tag(String?.none)
                        ForEach(model.branches, id: \.self) { Text($0).tag(Optional($0)) }
                    }
                }
                Divider()
                Button("Quitar filtros") { model.clearFilters() }
                    .disabled(!model.isFiltering)
            } label: {
                Label("Filtrar", systemImage: model.isFiltering
                      ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
            }
            .help(model.isFiltering ? "Filtros activos" : "Filtrar la lista")
            .accessibilityLabel(model.isFiltering ? "Filtros activos" : "Filtrar la lista")
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
