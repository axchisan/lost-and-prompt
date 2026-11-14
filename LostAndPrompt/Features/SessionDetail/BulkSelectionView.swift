import SwiftUI

/// En lugar del detalle cuando hay varias sesiones seleccionadas: qué se eligió y qué hacer con todas.
struct BulkSelectionView: View {
    @Environment(AppModel.self) private var model
    var sessions: [Session]

    var body: some View {
        let allFavorite = sessions.allSatisfy(\.isFavorite)
        let allArchived = sessions.allSatisfy(\.isArchived)
        let folders = Set(sessions.map(\.cwd)).count
        let messages = sessions.reduce(0) { $0 + $1.userMessages }
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(sessions.count) sesiones seleccionadas")
                    .font(.largeTitle.weight(.bold))
                Text(folders == 1 ? "De una carpeta · \(messages.grouped) mensajes" : "De \(folders) carpetas · \(messages.grouped) mensajes")
                    .foregroundStyle(.secondary)
            }

            // Con poco ancho (el panel de las tarjetas), los botones se quedan en su icono.
            ViewThatFits(in: .horizontal) {
                actions(allFavorite: allFavorite, allArchived: allArchived).labelStyle(.titleAndIcon)
                actions(allFavorite: allFavorite, allArchived: allArchived).labelStyle(.iconOnly)
            }
            .controlSize(.large)

            List {
                ForEach(sessions) { session in
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.title).lineLimit(1)
                            Text("\(session.folderName) · \(model.shortDate(session.lastActivity))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Quitar de la selección", systemImage: "xmark.circle.fill") {
                            model.selectedSessionIDs.remove(session.id)
                        }
                        .labelStyle(.iconOnly)
                        .buttonStyle(.borderless)
                        .foregroundStyle(.secondary)
                        .help("Quitar de la selección")
                    }
                }
            }
            .listStyle(.bordered)

            Text("⌘ + clic añade o quita una sesión · Mayús + clic elige un tramo · ⌘A todas las de la lista · Esc suelta la selección")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func actions(allFavorite: Bool, allArchived: Bool) -> some View {
        HStack(spacing: 8) {
            Button(allFavorite ? "Quitar de favoritos" : "Añadir a favoritos", systemImage: allFavorite ? "star.slash" : "star") {
                model.setFavorite(sessions, !allFavorite)
            }
            .help(allFavorite ? "Quitar de favoritos" : "Añadir a favoritos")
            Button(allArchived ? "Sacar del archivo" : "Archivar", systemImage: allArchived ? "tray.and.arrow.up" : "archivebox") {
                model.setArchived(sessions, !allArchived)
            }
            .help(allArchived ? "Sacar del archivo" : "Archivar")
            Menu("Colecciones", systemImage: "square.stack") {
                BulkCollectionToggles(sessions: sessions)
            }
            .fixedSize()
            .help("Colecciones")
            Button("Eliminar \(sessions.count)…", systemImage: "trash", role: .destructive) {
                model.requestDelete(sessions)
            }
            .help("Eliminar \(sessions.count)…")
            Button("Deseleccionar") { model.collapseSelection() }
                .labelStyle(.titleOnly)
                .help("Esc")
        }
        .fixedSize()
    }
}
