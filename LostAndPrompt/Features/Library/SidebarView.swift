import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        List(selection: $model.sidebarSelection) {
            Section {
                Label { Text("Recientes") } icon: { Image(systemName: "clock") }
                    .badge(model.activeSessions.filter { $0.userMessages > 0 }.count)
                    .tag(SidebarItem.recents)
                Label("Favoritos", systemImage: "star")
                    .badge(model.favoritesCount)
                    .tag(SidebarItem.favorites)
                Label("Actividad", systemImage: "chart.bar.xaxis")
                    .tag(SidebarItem.activity)
                if model.archivedCount > 0 {
                    Label("Archivadas", systemImage: "archivebox")
                        .badge(model.archivedCount)
                        .tag(SidebarItem.archived)
                }
            }

            Section("Colecciones") {
                ForEach(model.collections) { collection in
                    Label {
                        Text(collection.name)
                    } icon: {
                        TintDot(tint: collection.tint, size: 9)
                    }
                    .badge(model.count(in: collection.id))
                    .tag(SidebarItem.collection(collection.id))
                    // Sesiones (desde la lista) y carpetas (desde esta barra) se pueden soltar encima.
                    .onDrop(of: [.utf8PlainText, .plainText], isTargeted: nil) { providers in
                        model.receiveDrop(providers, on: collection.id)
                        return true
                    }
                    .contextMenu {
                        Button("Editar colección…", systemImage: "pencil") { model.editingCollection = collection }
                        let folders = model.folders(in: collection.id)
                        if !folders.isEmpty {
                            Menu("Carpetas incluidas", systemImage: "folder") {
                                ForEach(folders, id: \.self) { path in
                                    Button("Quitar \(Session.abbreviate(path))", systemImage: "minus.circle") {
                                        model.toggleFolder(path, in: collection.id)
                                    }
                                }
                            }
                        }
                        Divider()
                        Button("Eliminar colección", systemImage: "trash", role: .destructive) {
                            model.deleteCollection(collection.id)
                        }
                    }
                }
                Button {
                    model.isCreatingCollection = true
                } label: {
                    Label("Nueva colección", systemImage: "plus")
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            }

            Section("Carpetas") {
                ForEach(model.projectTree) { node in
                    ProjectRow(node: node, depth: 0)
                }
            }
        }
        .listStyle(.sidebar)
        .accessibilityLabel("Barra lateral")
        .navigationSplitViewColumnWidth(min: 200, ideal: 230, max: 300)
    }
}

/// Fila del árbol de carpetas; los dos primeros niveles empiezan abiertos.
private struct ProjectRow: View {
    @Environment(AppModel.self) private var model
    var node: ProjectNode
    var depth: Int
    @State private var isExpanded: Bool

    init(node: ProjectNode, depth: Int) {
        self.node = node
        self.depth = depth
        _isExpanded = State(initialValue: depth < 2)
    }

    var body: some View {
        if let children = node.children {
            DisclosureGroup(isExpanded: $isExpanded) {
                ForEach(children) { ProjectRow(node: $0, depth: depth + 1) }
            } label: {
                label
            }
        } else {
            label
        }
    }

    private var label: some View {
        Label(node.name, systemImage: node.path == Session.homePath ? "house" : "folder")
            .badge(node.sessionCount)
            .tag(SidebarItem.project(node.path))
            .help(node.path)
            .contextMenu {
                Button("Nueva sesión en esta carpeta", systemImage: "plus.bubble") { model.startNewSession(in: node.path) }
                Menu("Añadir a colección", systemImage: "square.stack") {
                    ForEach(model.collections) { collection in
                        Toggle(collection.name, isOn: Binding(
                            get: { model.isFolder(node.path, in: collection.id) },
                            set: { _ in model.toggleFolder(node.path, in: collection.id) }))
                    }
                    if !model.collections.isEmpty { Divider() }
                    Button("Nueva colección…") {
                        model.newCollectionTarget = .folder(node.path)
                        model.isCreatingCollection = true
                    }
                }
                if let editor = model.editor {
                    Button("Abrir en \(editor.shortName)", systemImage: "chevron.left.forwardslash.chevron.right") { model.openInEditor(node.path) }
                }
                Button("Mostrar en Finder", systemImage: "folder") {
                    NSWorkspace.shared.activateFileViewerSelecting([URL(filePath: node.path)])
                }
            }
    }
}

#Preview {
    NavigationSplitView {
        SidebarView()
    } detail: {
        Text("Detalle")
    }
    .environment(MockData.model())
    .frame(width: 700, height: 600)
}
