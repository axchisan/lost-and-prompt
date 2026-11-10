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
    @Environment(\.openWindow) private var openWindow
    @Environment(AppModel.self) private var model

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
            Button("Ver la guía de todo lo que puede hacer") {
                dismiss()
                model.guideTab = .guide
                openWindow(id: "guide")
            }
            .buttonStyle(.link)
            .padding(.top, -10)
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

/// Eliminar sesiones: enseña antes todo lo que se quita de Claude Code y cuánto ocupa.
struct DeleteSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let sessions: [Session]
    @State private var plan: SessionCleanup.Plan?
    @State private var permanent = false
    @State private var working = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(sessions.count == 1 ? "¿Eliminar «\(sessions[0].title)»?" : "¿Eliminar \(sessions.count) sesiones?")
                .font(.headline)
                .lineLimit(2)
            if let plan {
                if plan.sessions.isEmpty && plan.inUse.isEmpty {
                    Text("No se encontró nada que borrar.").foregroundStyle(.secondary)
                } else {
                    Text("Se quita todo lo que Claude Code guarda de ella:")
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(plan.kinds, id: \.kind) { entry in
                            LabeledContent("• " + entry.kind.title, value: ByteCountFormatter.string(fromByteCount: entry.bytes, countStyle: .file))
                        }
                        if plan.historyLines > 0 {
                            Text("• \(plan.historyLines) líneas del historial de lo que escribiste (flecha ↑ en Claude Code); antes se guarda una copia")
                        }
                        Text("• En Lost & Prompt: nombre, nota, favorito y colecciones")
                    }
                    .font(.callout)
                }
                if !plan.inUse.isEmpty {
                    Label("\(plan.inUse.count) abierta(s) ahora mismo en Claude Code: no se borra(n). Ciérrala(s) en la terminal primero.",
                          systemImage: "exclamationmark.triangle")
                        .font(.callout)
                        .foregroundStyle(.orange)
                }
                Toggle(isOn: $permanent) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Borrar sin dejar rastro")
                        Text(permanent ? "No pasa por la papelera: no se puede recuperar." : "Va a la papelera: puedes recuperarla desde ahí.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .toggleStyle(.checkbox)
            } else {
                HStack {
                    ProgressView().controlSize(.small)
                    Text("Comprobando qué guarda Claude Code de esta sesión…").foregroundStyle(.secondary)
                }
            }
            HStack {
                Spacer()
                Button("Cancelar", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(role: .destructive) {
                    working = true
                    let list = sessions.filter { !(plan?.inUse.contains($0.id) ?? false) }
                    Task {
                        await model.delete(list, permanent: permanent)
                        dismiss()
                    }
                } label: {
                    let size = ByteCountFormatter.string(fromByteCount: plan?.totalBytes ?? 0, countStyle: .file)
                    Text(permanent ? "Borrar para siempre (\(size))" : "Mover a la papelera (\(size))")
                }
                .disabled(plan == nil || plan?.sessions.isEmpty == true || working)
            }
        }
        .padding(20)
        .frame(width: 460)
        .task { plan = await model.deletePlan(for: sessions) }
    }
}

/// Reparar una carpeta movida: enseña antes qué carpetas de proyecto, ajustes e historial cambian.
struct RepairSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let from: String
    let to: String
    var moving = false
    @State private var plans: [(account: ClaudeAccount, plan: FolderRepair.Plan)]?
    @State private var check = FolderRepair.MoveCheck()
    @State private var working = false

    private var inUse: Bool { plans?.contains { !$0.plan.inUse.isEmpty } ?? false }
    private var empty: Bool { !moving && (plans?.isEmpty ?? true) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(moving ? "Mover carpeta" : "Reparar carpeta movida").font(.headline)
            Text("\(Session.abbreviate(from)) → \(Session.abbreviate(to))")
                .font(.callout.monospaced())
                .textSelection(.enabled)
            if let plans {
                if plans.isEmpty && !moving {
                    Text("No hay nada que pasar a esa carpeta.").foregroundStyle(.secondary)
                } else {
                    Text(moving
                         ? "La carpeta se moverá en el disco y Claude Code seguirá encontrando todo en la ruta nueva (también en las subcarpetas y en todas las cuentas):"
                         : "Claude Code volverá a encontrar todo en la ruta nueva (también en las subcarpetas y en todas las cuentas):")
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(plans, id: \.account.id) { entry in
                            ForEach(entry.plan.folders) { folder in
                                HStack(spacing: 6) {
                                    Text("• " + Session.abbreviate(folder.toCWD)).lineLimit(1).truncationMode(.middle)
                                    if model.showsAccounts { AccountBadge(name: model.accountName(entry.account.id)) }
                                    if folder.merge { Text("se junta con la que ya existe").foregroundStyle(.secondary) }
                                    if folder.hasMemory { Text("con su memoria").foregroundStyle(.secondary) }
                                    Spacer()
                                    Text("\(folder.sessions) sesiones").foregroundStyle(.secondary)
                                }
                            }
                        }
                        let settings = plans.reduce(0) { $0 + $1.plan.settingsKeys.count }
                        if settings > 0 { Text("• Ajustes de \(settings) carpeta(s): confianza, servidores MCP y herramientas permitidas") }
                        let lines = plans.reduce(0) { $0 + $1.plan.historyLines }
                        if lines > 0 { Text("• \(lines) líneas del historial de lo que escribiste (flecha ↑)") }
                    }
                    .font(.callout)
                    Text(moving
                         ? "Antes se guarda una copia de todo lo que se reescribe de Claude Code. Si algo falla, la carpeta vuelve a su sitio."
                         : "Antes se guarda una copia de todo lo que se reescribe. La carpeta del disco no se toca.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let error = check.error {
                        Label(error, systemImage: "xmark.octagon").font(.callout).foregroundStyle(.red)
                    }
                    if check.isWorktree {
                        Label("Es un worktree de git: después ejecuta «git worktree repair» desde el repositorio principal.", systemImage: "exclamationmark.triangle")
                            .font(.callout).foregroundStyle(.orange)
                    }
                    if check.hasWorktrees {
                        Label("Tiene worktrees de git en otras carpetas: después ejecuta «git worktree repair» dentro de ella.", systemImage: "exclamationmark.triangle")
                            .font(.callout).foregroundStyle(.orange)
                    }
                    if !moving && !FileManager.default.fileExists(atPath: to) {
                        Label("Esa carpeta no existe en el disco. Si todavía no la has movido, muévela antes.", systemImage: "exclamationmark.triangle")
                            .font(.callout).foregroundStyle(.orange)
                    }
                    if inUse {
                        Label("Hay una sesión abierta en esa carpeta. Ciérrala en la terminal primero.", systemImage: "exclamationmark.triangle")
                            .font(.callout).foregroundStyle(.orange)
                    }
                }
            } else {
                HStack {
                    ProgressView().controlSize(.small)
                    Text("Comprobando qué guarda Claude Code de esta carpeta…").foregroundStyle(.secondary)
                }
            }
            HStack {
                Spacer()
                Button("Cancelar", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(moving ? "Mover" : "Reparar") {
                    working = true
                    Task {
                        await model.applyRepair(from: from, to: to, moving: moving)
                        dismiss()
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(plans == nil || empty || inUse || working || (moving && check.error != nil))
            }
        }
        .padding(20)
        .frame(width: 520)
        .task {
            if moving { check = FolderRepair.checkMove(from: from, to: to) }
            plans = await model.repairPlans(from: from, to: to)
        }
    }
}
