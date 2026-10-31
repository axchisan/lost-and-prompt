import SwiftUI

struct SessionDetailView: View {
    @Environment(AppModel.self) private var model
    var session: Session

    var body: some View {
        let messages = ConversationView.messages(for: session, in: model)
        let matches = FindMatches(messages: messages, query: model.isFindPresented ? model.findText : "")
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                        .padding(.horizontal, 32)
                        .padding(.top, 8)
                        .padding(.bottom, 22)
                    Divider()
                    ConversationView(session: session, messages: messages, matches: matches, current: model.findIndex)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 22)
                }
                .frame(maxWidth: 820, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                if model.isFindPresented { FindBar(total: matches.total) }
            }
            .onChange(of: matches.total, initial: true) { model.findTotal = matches.total }
            .onChange(of: "\(model.findIndex)|\(matches.total)|\(model.findText)") {
                guard let target = matches.location(of: model.findIndex) else { return }
                // La lista es perezosa: primero el mensaje (para que se dibuje) y después el bloque exacto.
                proxy.scrollTo(target.message, anchor: .top)
                Task {
                    try? await Task.sleep(for: .milliseconds(60))
                    withAnimation(.easeInOut(duration: 0.2)) { proxy.scrollTo(target.block, anchor: .center) }
                }
            }
        }
        .toolbar { toolbarItems }
        .navigationTitle("")
        // Se repite cuando la sesión cambia en disco (Claude Code sigue escribiendo en ella), no solo
        // al elegir otra.
        .task(id: "\(session.id)|\(session.lastActivity.timeIntervalSince1970)") { await model.loadMessages(for: session) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label {
                Text(session.abbreviatedPath).font(.callout.monospaced()).textSelection(.enabled)
            } icon: {
                Image(systemName: session.isInHome ? "house" : "folder")
            }
            .foregroundStyle(.secondary)

            Text(session.title)
                .font(.largeTitle.weight(.bold))
                .textSelection(.enabled)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 20) { facts }
                VStack(alignment: .leading, spacing: 6) {
                    Text(model.relativeDay(session.lastActivity))
                    HStack(spacing: 16) { factsWithoutDate }
                }
            }
            .font(.callout)
            .foregroundStyle(.secondary)

            if let note = session.note {
                Button {
                    model.editingNoteFor = session
                } label: {
                    Label { Text(note).multilineTextAlignment(.leading) } icon: { Image(systemName: "note.text") }
                        .font(.callout)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(.yellow.opacity(0.12), in: .rect(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .help("Editar nota")
            }

            if !session.folderExists { MissingFolderBanner { model.chooseFolder(for: session) } }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) {
                    resumeButton
                    Button("Copiar comando", systemImage: "doc.on.doc") { model.copyResumeCommand(session) }
                    folderButton
                }
                HStack(spacing: 10) {
                    resumeButton
                    Button("Copiar comando", systemImage: "doc.on.doc") { model.copyResumeCommand(session) }
                        .labelStyle(.iconOnly).help("Copiar comando")
                    folderButton.labelStyle(.iconOnly)
                }
            }
            .controlSize(.large)
            .padding(.top, 4)
        }
    }

    private var resumeButton: some View {
        Button {
            model.resume(session)
        } label: {
            Label("Reanudar en \(model.terminal.resumeName)", systemImage: "terminal")
                .padding(.horizontal, 4)
        }
        .buttonStyle(.borderedProminent)
        .keyboardShortcut(.return, modifiers: .command)
        .fixedSize()
    }

    /// «Abrir en VS Code» si hay un editor conocido instalado; si no, la carpeta en Finder.
    @ViewBuilder private var folderButton: some View {
        if let editor = model.editor {
            Button("Abrir en \(editor.shortName)", systemImage: "chevron.left.forwardslash.chevron.right") { model.openInEditor(session.cwd) }
                .help("Abrir la carpeta en \(editor.displayName)")
                .disabled(!session.folderExists)
        } else {
            Button("Abrir carpeta", systemImage: "folder") { model.revealInFinder(session) }
                .help("Abrir carpeta")
        }
    }

    @ViewBuilder private var factsWithoutDate: some View {
        Fact(value: session.userMessages.grouped, label: "mensajes").fixedSize()
        if let duration = session.durationText {
            Fact(value: duration).fixedSize().help("Del primer al último mensaje")
        }
        if let cost = session.costUSD { Fact(value: cost.usd).fixedSize() }
        Text(session.model).fixedSize()
    }

    @ViewBuilder private var facts: some View {
        Text(model.relativeDay(session.lastActivity)).fixedSize()
        factsWithoutDate
        if let branch = session.gitBranch { Fact(value: branch).fixedSize().help("Rama de git") }
    }

    @ToolbarContentBuilder private var toolbarItems: some ToolbarContent {
        ToolbarItemGroup {
            Button {
                model.toggleFavorite(session.id)
            } label: {
                Label("Favorito", systemImage: session.isFavorite ? "star.fill" : "star")
            }
            .help(session.isFavorite ? "Quitar de favoritos (⌘D)" : "Añadir a favoritos (⌘D)")

            Menu {
                ForEach(model.collections) { collection in
                    Toggle(collection.name, isOn: Binding(
                        get: { session.collectionIDs.contains(collection.id) },
                        set: { _ in model.toggle(session.id, in: collection.id) }))
                }
                Divider()
                Button("Nueva colección…") { model.isCreatingCollection = true }
            } label: {
                Label("Colecciones", systemImage: "square.stack")
            }
            .help("Añadir a una colección")

            Menu {
                Button("Renombrar…", systemImage: "pencil") { model.renamingSession = session }
                Button(session.note == nil ? "Añadir nota…" : "Editar nota…", systemImage: "note.text") { model.editingNoteFor = session }
                Button(session.isArchived ? "Sacar del archivo" : "Archivar",
                       systemImage: session.isArchived ? "tray.and.arrow.up" : "archivebox") { model.toggleArchive(session.id) }
                Divider()
                Button("Nueva sesión en esta carpeta", systemImage: "plus.bubble") { model.startNewSession(in: session.cwd) }
                    .disabled(!session.folderExists)
                Button("Buscar en la conversación", systemImage: "text.magnifyingglass") { model.showFind() }
                Divider()
                if let editor = model.editor {
                    Button("Abrir en \(editor.shortName)", systemImage: "chevron.left.forwardslash.chevron.right") { model.openInEditor(session.cwd) }
                        .disabled(!session.folderExists)
                }
                Button("Mostrar en Finder", systemImage: "folder") { model.revealInFinder(session) }
                Button("Copiar ID de la sesión", systemImage: "number") { model.copySessionID(session) }
            } label: {
                Label("Más", systemImage: "ellipsis.circle")
            }
        }
    }
}

struct MissingFolderBanner: View {
    var chooseFolder: () -> Void = {}

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text("La carpeta ya no existe").fontWeight(.semibold)
                Text("Elige dónde reanudar esta sesión. Claude Code la buscará en la carpeta nueva.")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Elegir carpeta…", action: chooseFolder)
        }
        .font(.callout)
        .padding(12)
        .background(.orange.opacity(0.1), in: .rect(cornerRadius: 10))
    }
}

/// Vista previa de la conversación: solo tus mensajes y las respuestas de Claude.
struct ConversationView: View {
    @Environment(AppModel.self) private var model
    var session: Session
    var messages: [Message]
    var matches: FindMatches
    var current: Int

    /// Los mensajes leídos; con datos de ejemplo, el primer mensaje y la última respuesta.
    static func messages(for session: Session, in model: AppModel) -> [Message] {
        if let loaded = model.messages[session.id] { return model.showThinking ? loaded : loaded.filter { !$0.isThinking } }
        guard session.filePath == nil else { return [] }
        var list = [Message(role: .user, date: session.startedAt, text: session.firstPrompt)]
        if let reply = session.lastReply { list.append(Message(role: .assistant, date: session.lastActivity, text: reply)) }
        return list
    }

    var body: some View {
        @Bindable var model = model
        LazyVStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Conversación").font(.title3.weight(.semibold))
                Spacer()
                Menu {
                    Toggle("Herramientas", isOn: $model.showToolCalls)
                    Toggle("Razonamiento", isOn: $model.showThinking)
                } label: {
                    Label("Mostrar", systemImage: "line.3.horizontal.decrease.circle")
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
            }

            if session.filePath != nil && model.messages[session.id] == nil {
                ProgressView("Leyendo la conversación…")
                    .controlSize(.small)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                    MessageView(message: message, showTools: model.showToolCalls,
                                highlight: matches.highlight(forMessage: index, current: current))
                }
            }
        }
    }
}

/// Coincidencias de la búsqueda dentro de la conversación, mensaje por mensaje y bloque por bloque.
struct FindMatches {
    let query: String
    private(set) var total = 0
    /// Por mensaje: id y coincidencias de cada bloque.
    private var perMessage: [(id: Message.ID, blocks: [Int])] = []
    private var starts: [Int] = []

    init(messages: [Message], query: String) {
        self.query = query.trimmingCharacters(in: .whitespaces)
        guard !self.query.isEmpty else { return }
        for message in messages {
            let blocks = MarkdownBlock.blocks(message.text).map { FindHighlight.count(self.query, in: $0.segments) }
            starts.append(total)
            perMessage.append((message.id, blocks))
            total += blocks.reduce(0, +)
        }
    }

    func highlight(forMessage index: Int, current: Int) -> FindHighlight? {
        guard total > 0, index < starts.count else { return nil }
        return FindHighlight(query: query, current: current - starts[index])
    }

    /// Mensaje y bloque (el id que usa `MarkdownView`) de la coincidencia `ordinal`.
    func location(of ordinal: Int) -> (message: Message.ID, block: String)? {
        guard ordinal < total else { return nil }
        var remaining = ordinal
        for message in perMessage {
            for (index, count) in message.blocks.enumerated() {
                if remaining < count { return (message.id, "\(message.id.uuidString)-\(index)") }
                remaining -= count
            }
        }
        return nil
    }
}

/// Barra de ⌘F: buscar dentro de la conversación abierta.
struct FindBar: View {
    @Environment(AppModel.self) private var model
    var total: Int
    @FocusState private var focused: Bool

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Buscar en la conversación", text: $model.findText)
                    .textFieldStyle(.plain)
                    .focused($focused)
                    .onKeyPress(.return, phases: .down) { press in
                        model.moveFind(by: press.modifiers.contains(.shift) ? -1 : 1)
                        return .handled
                    }
                    .onKeyPress(.escape) {
                        model.isFindPresented = false
                        return .handled
                    }
                if !model.findText.trimmingCharacters(in: .whitespaces).isEmpty {
                    Text(total == 0 ? String(localized: "Sin resultados") : String(localized: "\(model.findIndex + 1) de \(total)"))
                        .font(.callout)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                ControlGroup {
                    Button("Anterior", systemImage: "chevron.up") { model.moveFind(by: -1) }
                        .help("Anterior (⇧⌘G)")
                    Button("Siguiente", systemImage: "chevron.down") { model.moveFind(by: 1) }
                        .help("Siguiente (⌘G)")
                }
                .controlGroupStyle(.navigation)
                .labelStyle(.iconOnly)
                .fixedSize()
                .disabled(total == 0)
                Button("Listo") { model.isFindPresented = false }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            Divider()
        }
        .background(.bar)
        .onAppear { focused = true }
        .onChange(of: model.isFindPresented) { if model.isFindPresented { focused = true } }
    }
}

struct MessageView: View {
    var message: Message
    var showTools: Bool
    var highlight: FindHighlight?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            MessageAvatar(role: message.role)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(message.role == .user ? "Tú" : "Claude").fontWeight(.semibold)
                    if message.isThinking {
                        Label("Razonamiento", systemImage: "brain").labelStyle(.titleAndIcon).foregroundStyle(.secondary)
                    }
                    Text(message.date.formatted(date: .omitted, time: .shortened))
                        .foregroundStyle(.tertiary)
                }
                .font(.callout)
                if !message.text.isEmpty {
                    MarkdownView(blocks: MarkdownBlock.blocks(message.text), highlight: highlight, idPrefix: message.id.uuidString)
                        .textSelection(.enabled)
                        .foregroundStyle(message.isThinking ? .secondary : .primary)
                        .padding(message.isThinking ? 10 : 0)
                        .background(message.isThinking ? AnyShapeStyle(.quaternary.opacity(0.4)) : AnyShapeStyle(.clear), in: .rect(cornerRadius: 8))
                }
                if message.toolCount > 0 {
                    Label(message.toolCount == 1 ? "1 herramienta" : "\(message.toolCount) herramientas",
                          systemImage: showTools ? "chevron.down" : "wrench.and.screwdriver")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.quaternary.opacity(0.6), in: .capsule)
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: 640, alignment: .leading)
        }
    }
}

#Preview {
    let model = MockData.model()
    return NavigationStack { SessionDetailView(session: model.selectedSession!) }
        .environment(model)
        .frame(width: 760, height: 720)
}
