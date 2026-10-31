import SwiftUI

/// Lista central (dirección A): sesiones agrupadas por día.
struct SessionListView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        let sessions = model.visibleSessions
        Group {
            if sessions.isEmpty {
                emptyState
            } else {
                List(selection: $model.selectedSessionID) {
                    if model.usesRealData && model.retentionDays == nil && model.searchText.isEmpty {
                        RetentionBanner()
                    }
                    ForEach(model.dayGroups(for: sessions)) { group in
                        Section(group.title) {
                            ForEach(group.sessions) { session in
                                SessionRow(session: session)
                                    .tag(session.id)
                                    .contextMenu { SessionContextMenu(session: session) }
                            }
                        }
                    }
                }
                .listStyle(.inset)
                .scrollContentBackground(.hidden)
                .onKeyPress(.return) {
                    guard let session = model.selectedSession else { return .ignored }
                    model.resume(session)
                    return .handled
                }
            }
        }
        .navigationTitle(model.sectionTitle)
        .navigationSubtitle(subtitle(count: sessions.count))
        .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 460)
    }

    private func subtitle(count: Int) -> String {
        if let progress = model.indexingProgress {
            return String(localized: "Indexando mensajes: \(progress.done) de \(progress.total)")
        }
        return count == 1 ? String(localized: "1 sesión") : String(localized: "\(count) sesiones")
    }

    @ViewBuilder private var emptyState: some View {
        if model.isLoading {
            ProgressView("Leyendo tus sesiones de Claude Code…")
        } else if !model.searchText.isEmpty {
            ContentUnavailableView.search(text: model.searchText)
        } else if model.usesRealData && !model.claudeFolderExists {
            ContentUnavailableView("No encontramos Claude Code", systemImage: "questionmark.folder",
                                   description: Text("Lost & Prompt lee las sesiones de ~/.claude/projects. Usa Claude Code al menos una vez y aparecerán aquí."))
        } else if model.sidebarSelection == .favorites {
            ContentUnavailableView("Aún no hay favoritos", systemImage: "star",
                                   description: Text("Marca una sesión con ⌘D para tenerla siempre a mano."))
        } else {
            ContentUnavailableView("No hay sesiones", systemImage: "tray",
                                   description: Text("Las sesiones de Claude Code que abras aparecerán aquí."))
        }
    }
}

struct SessionRow: View {
    @Environment(AppModel.self) private var model
    var session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(session.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(model.shortDate(session.lastActivity))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            HStack(spacing: 5) {
                if session.isFavorite {
                    Image(systemName: "star.fill").foregroundStyle(.yellow)
                }
                ForEach(session.collectionIDs, id: \.self) { id in
                    if let collection = model.collection(id) { TintDot(tint: collection.tint, size: 7) }
                }
                Image(systemName: session.isInHome ? "house" : "folder")
                Text(session.folderName).lineLimit(1)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .imageScale(.small)

            if !model.searchText.isEmpty, let snippet = model.contentHits[session.id] {
                SnippetText(snippet: snippet)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Aviso cuando Claude Code está borrando historial con el plazo por defecto de 30 días.
struct RetentionBanner: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Claude Code borra las sesiones de más de 30 días", systemImage: "clock.badge.exclamationmark")
                .font(.callout.weight(.semibold))
            Text("Es el plazo por defecto. Puedes conservarlas más tiempo; se guarda una copia de tus ajustes antes de cambiarlos.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Button("Conservar 6 meses") { model.applyRetention(180) }
                SettingsLink { Text("Otro plazo…") }
            }
            .controlSize(.small)
        }
        .padding(12)
        .background(.orange.opacity(0.1), in: .rect(cornerRadius: 10))
        .listRowSeparator(.hidden)
        .selectionDisabled()
    }
}

/// Menú contextual compartido por filas y tarjetas.
struct SessionContextMenu: View {
    @Environment(AppModel.self) private var model
    var session: Session

    var body: some View {
        Button("Reanudar en \(model.terminal.resumeName)", systemImage: "terminal") { model.resume(session) }
        Button("Copiar comando", systemImage: "doc.on.doc") { model.copyResumeCommand(session) }
        Divider()
        Button(session.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos",
               systemImage: session.isFavorite ? "star.slash" : "star") {
            model.toggleFavorite(session.id)
        }
        Menu("Colecciones", systemImage: "square.stack") {
            ForEach(model.collections) { collection in
                Toggle(collection.name, isOn: Binding(
                    get: { session.collectionIDs.contains(collection.id) },
                    set: { _ in model.toggle(session.id, in: collection.id) }))
            }
        }
        Button("Renombrar…", systemImage: "pencil") { model.renamingSession = session }
        Divider()
        Button("Nueva sesión en esta carpeta", systemImage: "plus.bubble") { model.startNewSession(in: session.cwd) }
            .disabled(!session.folderExists)
        if let editor = model.editor {
            Button("Abrir en \(editor.shortName)", systemImage: "chevron.left.forwardslash.chevron.right") { model.openInEditor(session.cwd) }
                .disabled(!session.folderExists)
        }
        Button("Mostrar en Finder", systemImage: "folder") { model.revealInFinder(session) }
    }
}

#Preview("Filas") {
    NavigationStack { SessionListView() }
        .environment(MockData.model())
        .frame(width: 360, height: 700)
}
