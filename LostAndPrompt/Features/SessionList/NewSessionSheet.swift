import SwiftUI

/// ⌘N: abre una sesión nueva de Claude Code en cualquier carpeta. Muestra primero las carpetas con
/// sesiones (las más recientes arriba) y las elegidas antes con «Elegir otra carpeta…».
struct NewSessionSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var selection: String?

    private var folders: [AppModel.NewSessionFolder] {
        let all = model.newSessionFolders
        let text = query.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return all }
        return all.filter { $0.path.localizedStandardContains(text) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Nueva sesión de Claude Code").font(.headline)
                Text("Elige la carpeta donde abrirla con \(model.terminal.resumeName).")
                    .foregroundStyle(.secondary)
            }
            TextField("Buscar carpeta", text: $query)
                .textFieldStyle(.roundedBorder)
                .onSubmit(openSelected)
            List(folders, selection: $selection) { folder in
                HStack(spacing: 10) {
                    Image(systemName: folder.path == Session.homePath ? "house" : "folder")
                        .foregroundStyle(.tint)
                        .frame(width: 18)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(folder.name).fontWeight(.medium)
                        Text(Session.abbreviate(folder.path)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    if folder.sessionCount > 0 {
                        Text(folder.sessionCount == 1 ? "1 sesión" : "\(folder.sessionCount) sesiones")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 2)
                .tag(folder.path)
                .contentShape(.rect)
                .onTapGesture(count: 2) { open(folder.path) }
                .accessibilityElement(children: .combine)
            }
            .listStyle(.bordered)
            .alternatingRowBackgrounds()
            .overlay {
                if folders.isEmpty {
                    ContentUnavailableView("Ninguna carpeta coincide", systemImage: "folder.badge.questionmark",
                                           description: Text("Usa «Elegir otra carpeta…» para abrirla igualmente."))
                }
            }
            HStack {
                Button("Elegir otra carpeta…") {
                    if model.chooseFolderForNewSession() { dismiss() }
                }
                Spacer()
                Button("Cancelar", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Abrir sesión", action: openSelected)
                    .keyboardShortcut(.defaultAction)
                    .disabled(currentSelection == nil)
            }
        }
        .padding(20)
        .frame(width: 540, height: 460)
        .onAppear { selection = folders.first?.path }
        .onChange(of: query) { selection = folders.first?.path }
    }

    /// La carpeta elegida, o la primera de la lista si la búsqueda dejó la selección fuera.
    private var currentSelection: String? {
        if let selection, folders.contains(where: { $0.path == selection }) { return selection }
        return folders.first?.path
    }

    private func openSelected() {
        if let path = currentSelection { open(path) }
    }

    private func open(_ path: String) {
        model.startNewSession(in: path)
        dismiss()
    }
}

#Preview {
    NewSessionSheet().environment(MockData.model())
}
