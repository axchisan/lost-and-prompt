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
                List(selection: $model.selectedSessionIDs) {
                    if model.usesRealData && model.currentRetentionDays == nil && model.searchText.isEmpty {
                        RetentionBanner()
                    }
                    ForEach(model.dayGroups(for: sessions)) { group in
                        Section(group.title) {
                            ForEach(group.sessions) { session in
                                SessionRow(session: session)
                                    .tag(session.id)
                                    .onDrag { NSItemProvider(object: session.id.uuidString as NSString) }
                            }
                        }
                    }
                }
                // Clic derecho sobre una de las seleccionadas: el menú es para todas.
                .contextMenu(forSelectionType: Session.ID.self) { ids in
                    SelectionContextMenu(ids: ids)
                }
                .listStyle(.inset)
                .accessibilityLabel(model.sectionTitle)
                .scrollContentBackground(.hidden)
                .onKeyPress(.escape) {
                    guard model.selectedSessionIDs.count > 1 else { return .ignored }
                    model.collapseSelection()
                    return .handled
                }
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
        } else if model.isFiltering {
            ContentUnavailableView {
                Label("Ninguna sesión con estos filtros", systemImage: "line.3.horizontal.decrease.circle")
            } actions: {
                Button("Quitar filtros") { model.clearFilters() }
            }
        } else if case .collection = model.sidebarSelection {
            ContentUnavailableView("Esta colección está vacía", systemImage: "square.stack",
                                   description: Text("Arrastra aquí sesiones de la lista. Para una carpeta entera, usa «Añadir a colección» en su menú contextual."))
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
                ForEach(session.allCollectionIDs, id: \.self) { id in
                    if let collection = model.collection(id) { TintDot(tint: collection.tint, size: 7) }
                }
                Image(systemName: session.isInHome ? "house" : "folder")
                Text(session.folderName).lineLimit(1)
                // Viendo todas las cuentas, las que no son la principal llevan su nombre.
                if model.showsAccounts, model.currentAccount == nil, session.accountEnvironment != nil {
                    AccountBadge(name: model.accountName(session.accountID))
                }
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
                Button("Conservar 6 meses") { model.applyRetention(180, account: model.currentAccount) }
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
/// Las colecciones de una sesión en sus menús. Las que la incluyen por su carpeta salen marcadas pero
/// no se quitan desde aquí (se quita la carpeta desde el menú de la colección o de la carpeta).
struct CollectionToggles: View {
    @Environment(AppModel.self) private var model
    var session: Session

    var body: some View {
        ForEach(model.collections) { collection in
            if session.folderCollectionIDs.contains(collection.id) && !session.collectionIDs.contains(collection.id) {
                Toggle("\(collection.name) (por su carpeta)", isOn: .constant(true)).disabled(true)
            } else {
                Toggle(collection.name, isOn: Binding(
                    get: { session.collectionIDs.contains(collection.id) },
                    set: { _ in model.toggle(session.id, in: collection.id) }))
            }
        }
        if !model.collections.isEmpty { Divider() }
        Button("Nueva colección…") {
            model.newCollectionTarget = .session(session.id)
            model.isCreatingCollection = true
        }
    }
}

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
            CollectionToggles(session: session)
        }
        Button("Renombrar…", systemImage: "pencil") { model.renamingSession = session }
        Button(session.isArchived ? "Sacar del archivo" : "Archivar",
               systemImage: session.isArchived ? "tray.and.arrow.up" : "archivebox") { model.toggleArchive(session.id) }
        Button("Eliminar…", systemImage: "trash", role: .destructive) { model.requestDelete([session]) }
        Divider()
        Button("Nueva sesión en esta carpeta", systemImage: "plus.bubble") { model.startNewSession(in: session.cwd) }
            .disabled(!session.folderExists)
        if let editor = model.editor {
            Button("Abrir en \(editor.shortName)", systemImage: "chevron.left.forwardslash.chevron.right") { model.openInEditor(session.cwd) }
                .disabled(!session.folderExists)
        }
        Button("Mostrar en Finder", systemImage: "folder") { model.revealInFinder(session) }
        Divider()
        ExportMenu(session: session)
    }
}

/// Menú contextual de la lista: el de la sesión si es una, el de varias si se hizo clic sobre la selección.
struct SelectionContextMenu: View {
    @Environment(AppModel.self) private var model
    var ids: Set<Session.ID>

    var body: some View {
        let list = model.visibleSessions.filter { ids.contains($0.id) }
        if list.count == 1, let session = list.first {
            SessionContextMenu(session: session)
        } else if list.count > 1 {
            BulkContextMenu(sessions: list)
        }
    }
}

/// Acciones para varias sesiones a la vez (menú contextual y menú de colecciones del panel).
struct BulkContextMenu: View {
    @Environment(AppModel.self) private var model
    var sessions: [Session]

    var body: some View {
        let allFavorite = sessions.allSatisfy(\.isFavorite)
        let allArchived = sessions.allSatisfy(\.isArchived)
        Text("\(sessions.count) sesiones seleccionadas")
        Button(allFavorite ? "Quitar de favoritos" : "Añadir a favoritos", systemImage: allFavorite ? "star.slash" : "star") {
            model.setFavorite(sessions, !allFavorite)
        }
        Button(allArchived ? "Sacar del archivo" : "Archivar", systemImage: allArchived ? "tray.and.arrow.up" : "archivebox") {
            model.setArchived(sessions, !allArchived)
        }
        Menu("Colecciones", systemImage: "square.stack") {
            BulkCollectionToggles(sessions: sessions)
        }
        Divider()
        Button("Eliminar \(sessions.count)…", systemImage: "trash", role: .destructive) { model.requestDelete(sessions) }
    }
}

/// Las colecciones para varias sesiones: marcada si están todas, con guion si solo algunas.
struct BulkCollectionToggles: View {
    @Environment(AppModel.self) private var model
    var sessions: [Session]

    var body: some View {
        ForEach(model.collections) { collection in
            let state = model.membership(sessions, in: collection.id)
            Button {
                model.setMembership(sessions, in: collection.id, state != true)
            } label: {
                switch state {
                case true?: Label(collection.name, systemImage: "checkmark")
                case nil: Label(collection.name, systemImage: "minus")
                case false?: Text(collection.name)
                }
            }
        }
        if !model.collections.isEmpty { Divider() }
        Button("Nueva colección con las \(sessions.count)…") {
            model.newCollectionTarget = .sessions(sessions.map(\.id))
            model.isCreatingCollection = true
        }
    }
}

/// «Exportar»: la conversación en Markdown para leerla, o el archivo de la sesión para que otra
/// persona la importe y la continúe en Claude Code.
struct ExportMenu: View {
    @Environment(AppModel.self) private var model
    var session: Session

    var body: some View {
        Menu("Exportar", systemImage: "square.and.arrow.up") {
            Button("Copiar como Markdown", systemImage: "doc.on.clipboard") { model.copyMarkdown(session) }
            Button("Exportar como Markdown…", systemImage: "doc.text") { model.exportMarkdown(session) }
            ShareLink(item: SessionMarkdownFile(session: session), preview: SharePreview(session.title)) {
                Label("Compartir conversación…", systemImage: "square.and.arrow.up")
            }
            Divider()
            Button("Exportar para continuar en Claude Code…", systemImage: "arrow.up.doc") { model.exportForClaudeCode(session) }
                .disabled(session.filePath == nil)
        }
    }
}

#Preview("Filas") {
    NavigationStack { SessionListView() }
        .environment(MockData.model())
        .frame(width: 360, height: 700)
}
