import SwiftUI

struct SessionDetailView: View {
    @Environment(AppModel.self) private var model
    var session: Session

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.horizontal, 32)
                    .padding(.top, 8)
                    .padding(.bottom, 22)
                Divider()
                ConversationView(session: session)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 22)
            }
            .frame(maxWidth: 820, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .toolbar { toolbarItems }
        .navigationTitle("")
        .task(id: session.id) { await model.loadMessages(for: session) }
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
                    Button("Abrir carpeta", systemImage: "folder") { model.revealInFinder(session) }
                }
                HStack(spacing: 10) {
                    resumeButton
                    Button("Copiar comando", systemImage: "doc.on.doc") { model.copyResumeCommand(session) }
                        .labelStyle(.iconOnly).help("Copiar comando")
                    Button("Abrir carpeta", systemImage: "folder") { model.revealInFinder(session) }
                        .labelStyle(.iconOnly).help("Abrir carpeta")
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
            Label("Reanudar en \(model.terminal.displayName)", systemImage: "terminal")
                .padding(.horizontal, 4)
        }
        .buttonStyle(.borderedProminent)
        .keyboardShortcut(.return, modifiers: .command)
        .fixedSize()
    }

    @ViewBuilder private var factsWithoutDate: some View {
        Fact(value: session.userMessages.grouped, label: "mensajes").fixedSize()
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
                Divider()
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
                let messages = model.messages[session.id] ?? placeholder
                ForEach(messages) { message in
                    MessageView(message: message, showTools: model.showToolCalls)
                }
            }
        }
    }

    private var placeholder: [Message] {
        var list = [Message(role: .user, date: session.startedAt, text: session.firstPrompt)]
        if let reply = session.lastReply { list.append(Message(role: .assistant, date: session.lastActivity, text: reply)) }
        return list
    }
}

struct MessageView: View {
    var message: Message
    var showTools: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            MessageAvatar(role: message.role)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(message.role == .user ? "Tú" : "Claude").fontWeight(.semibold)
                    Text(message.date.formatted(date: .omitted, time: .shortened))
                        .foregroundStyle(.tertiary)
                }
                .font(.callout)
                if !message.text.isEmpty {
                    Text(markdown)
                        .lineSpacing(2)
                        .textSelection(.enabled)
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

    private var markdown: AttributedString {
        (try? AttributedString(markdown: message.text,
                               options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(message.text)
    }
}

#Preview {
    let model = MockData.model()
    return NavigationStack { SessionDetailView(session: model.selectedSession!) }
        .environment(model)
        .frame(width: 760, height: 720)
}
