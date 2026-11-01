import SwiftUI

struct RenameSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var session: Session
    @State private var title = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Renombrar sesión").font(.headline)
            TextField("Nombre", text: $title, prompt: Text(session.aiTitle))
                .textFieldStyle(.roundedBorder)
                .frame(width: 360)
                .onSubmit(save)
            Text("Solo cambia el nombre en Lost & Prompt. Déjalo vacío para volver al título original.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Spacer()
                Button("Cancelar", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Guardar", action: save)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 400)
        .onAppear { title = session.customTitle ?? session.aiTitle }
    }

    private func save() {
        model.rename(session.id, to: title)
        dismiss()
    }
}

/// Crear una colección (y añadirle la sesión o carpeta desde la que se pidió) o editar una existente.
struct CollectionSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var editing: SessionCollection?
    @State private var name = ""
    @State private var tint: SessionCollection.Tint = .blue

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(editing == nil ? "Nueva colección" : "Editar colección").font(.headline)
            if editing == nil, let hint = targetHint {
                Text(hint).font(.callout).foregroundStyle(.secondary)
            }
            TextField("Nombre", text: $name, prompt: Text("Por ejemplo: Trabajo"))
                .textFieldStyle(.roundedBorder)
                .onSubmit(save)
            HStack(spacing: 10) {
                ForEach(SessionCollection.Tint.allCases, id: \.self) { option in
                    Button {
                        tint = option
                    } label: {
                        TintDot(tint: option, size: 20)
                            .overlay(Circle().strokeBorder(.primary.opacity(tint == option ? 0.7 : 0), lineWidth: 2).padding(-3))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(option.rawValue)
                    .accessibilityAddTraits(tint == option ? .isSelected : [])
                }
            }
            .padding(.vertical, 4)
            HStack {
                Spacer()
                Button("Cancelar", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(editing == nil ? "Crear" : "Guardar", action: save)
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 380)
        .onAppear {
            if let editing {
                name = editing.name
                tint = editing.tint
            }
        }
    }

    /// «Incluirá …»: qué entra al crearla, si se pidió desde una sesión o una carpeta.
    private var targetHint: String? {
        switch model.newCollectionTarget {
        case .session(let id): model.sessions.first { $0.id == id }.map { String(localized: "Incluirá la sesión «\($0.title)».") }
        case .folder(let path): String(localized: "Incluirá todas las sesiones de \(Session.abbreviate(path)).")
        case nil: nil
        }
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        if let editing {
            model.updateCollection(editing.id, name: trimmed, tint: tint)
        } else {
            let collection = model.createCollection(name: trimmed, tint: tint)
            switch model.newCollectionTarget {
            case .session(let id): model.toggle(id, in: collection.id)
            case .folder(let path): model.toggleFolder(path, in: collection.id)
            case nil: break
            }
            model.newCollectionTarget = nil
            model.sidebarSelection = .collection(collection.id)
        }
        dismiss()
    }
}

struct NoteSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var session: Session
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nota").font(.headline)
            Text(session.title).font(.callout).foregroundStyle(.secondary).lineLimit(1)
            TextEditor(text: $text)
                .font(.body)
                .frame(width: 400, height: 140)
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(.background.secondary, in: .rect(cornerRadius: 8))
            Text("Por ejemplo, qué quedó pendiente. Solo se guarda en Lost & Prompt.")
                .font(.callout)
                .foregroundStyle(.secondary)
            HStack {
                if session.note != nil {
                    Button("Borrar nota", role: .destructive) { model.setNote(session.id, to: ""); dismiss() }
                }
                Spacer()
                Button("Cancelar", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Guardar") { model.setNote(session.id, to: text); dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .onAppear { text = session.note ?? "" }
    }
}

struct WelcomeSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 22) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 96, height: 96)
            VStack(spacing: 6) {
                Text("Te damos la bienvenida a Lost & Prompt").font(.title2.weight(.bold))
                Text("Todas tus sesiones de Claude Code, de todas tus carpetas, en un solo lugar.")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            VStack(alignment: .leading, spacing: 16) {
                feature("magnifyingglass", "Encuentra cualquier sesión",
                        "Busca por título, carpeta o lo que se dijo en la conversación. ⌥⌘K abre el buscador desde cualquier app.")
                feature("terminal", "Reanuda en tu terminal",
                        "Un clic abre la sesión en Warp, Terminal, iTerm2 o Ghostty, en su carpeta original.")
                feature("square.stack", "Organiza a tu manera",
                        "Favoritos, nombres propios, colecciones y notas, sin tocar los archivos de Claude Code.")
                feature("lock", "Todo se queda en tu Mac",
                        "Lost & Prompt solo lee ~/.claude y no envía nada a ningún servidor.")
            }
            .frame(maxWidth: 420)
            Button {
                dismiss()
            } label: {
                Text("Empezar").frame(maxWidth: 220)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .keyboardShortcut(.defaultAction)
        }
        .padding(32)
        .frame(width: 520)
    }

    private func feature(_ symbol: String, _ title: LocalizedStringKey, _ detail: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(.tint)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
