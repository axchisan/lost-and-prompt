import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        List(selection: $model.sidebarSelection) {
            Section {
                Label { Text("Recientes") } icon: { Image(systemName: "clock") }
                    .badge(model.sessions.filter { $0.userMessages > 0 }.count)
                    .tag(SidebarItem.recents)
                Label("Favoritos", systemImage: "star")
                    .badge(model.favoritesCount)
                    .tag(SidebarItem.favorites)
                Label("Actividad", systemImage: "chart.bar.xaxis")
                    .tag(SidebarItem.activity)
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
                    .contextMenu {
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
