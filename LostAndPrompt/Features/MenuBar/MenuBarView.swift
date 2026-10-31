import SwiftUI

/// Contenido del ícono de la barra de menús: las últimas sesiones, a un clic.
struct MenuBarView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow
    @State private var query = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField("Buscar sesiones", text: $query)
                .textFieldStyle(.roundedBorder)
                .padding(.bottom, 4)

            Text("Recientes")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 6)

            ForEach(recent) { session in
                Button {
                    model.resume(session)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(session.title).lineLimit(1)
                            Text(session.folderName).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(model.shortDate(session.lastActivity)).font(.caption).foregroundStyle(.secondary)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
            }

            Divider().padding(.vertical, 4)

            HStack {
                Button("Abrir Lost & Prompt") { openWindow(id: "main") }
                Spacer()
                SettingsLink { Image(systemName: "gearshape") }
            }
            .buttonStyle(.borderless)
            .padding(.horizontal, 6)
        }
        .padding(12)
        .frame(width: 320)
    }

    private var recent: [Session] {
        let base = model.sessions.filter { $0.userMessages > 0 }
            .filter { query.isEmpty || $0.title.localizedStandardContains(query) }
            .sorted { $0.lastActivity > $1.lastActivity }
        return Array(base.prefix(6))
    }
}

#Preview {
    MenuBarView().environment(MockData.model())
}
