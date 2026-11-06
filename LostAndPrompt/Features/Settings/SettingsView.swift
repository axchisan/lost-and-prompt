import ServiceManagement
import SwiftUI

struct SettingsView: View {
    enum Pane: String, Hashable { case general, history, appearance }

    /// `-LPSettingsPane history|appearance` abre esa pestaña (para capturas). La guía elige la
    /// pestaña de lo que explica guardando `settingsPane` antes de abrir los ajustes.
    @AppStorage("settingsPane") private var pane: Pane = Self.initialPane

    private static var initialPane: Pane {
        switch UserDefaults.standard.string(forKey: "LPSettingsPane") {
        case "history": .history
        case "appearance": .appearance
        default: .general
        }
    }

    var body: some View {
        TabView(selection: $pane) {
            Tab("General", systemImage: "gearshape", value: .general) { GeneralSettings() }
            Tab("Historial", systemImage: "clock.arrow.circlepath", value: .history) { HistorySettings() }
            Tab("Apariencia", systemImage: "paintbrush", value: .appearance) { AppearanceSettings() }
        }
        .frame(width: 560)
    }
}

private struct GeneralSettings: View {
    @Environment(AppModel.self) private var model
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
    @AppStorage("showMenuBarExtra") private var showInMenuBar = true

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Picker("Reanudar en", selection: $model.terminal) {
                    ForEach(TerminalApp.available) { Text($0.displayName).tag($0) }
                }
                if model.terminal == .custom {
                    TextField("Comando de la terminal", text: $model.customTerminal,
                              prompt: Text(verbatim: "open -na WezTerm --args start --cwd {cwd} -- zsh -lc \"{command}\""))
                        .font(.callout.monospaced())
                    Text("{cwd} es la carpeta de la sesión y {command} el comando de Claude Code.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                TextField("Argumentos extra", text: $model.extraArguments, prompt: Text("Por ejemplo: --model opus"))
                LabeledContent("Comando") {
                    Text("cd '<carpeta>' && claude --resume <id> \(model.extraArguments)")
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            } header: {
                Text("Terminal")
            }

            Section {
                Picker("Abrir carpetas en", selection: $model.editor) {
                    ForEach(EditorApp.available) { Text($0.displayName).tag(Optional($0)) }
                    if EditorApp.available.isEmpty { Text("Ningún editor instalado").tag(EditorApp?.none) }
                }
                .disabled(EditorApp.available.isEmpty)
            } header: {
                Text("Editor")
            } footer: {
                Text("VS Code, Cursor, Windsurf, Zed, Sublime Text, Nova, Xcode o los IDE de JetBrains.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            UpdatesSection()

            Section("Lanzador") {
                Toggle("Mostrar en la barra de menús", isOn: $showInMenuBar)
                LabeledContent("Atajo global", value: "⌥⌘K")
                Toggle("Abrir al iniciar sesión", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, enabled in
                        do {
                            if enabled { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                        } catch {
                            model.errorMessage = error.localizedDescription
                            launchAtLogin = SMAppService.mainApp.status == .enabled
                        }
                    }
            }
        }
        .formStyle(.grouped)
    }
}

private struct UpdatesSection: View {
    @Environment(AppUpdater.self) private var updater

    var body: some View {
        @Bindable var updater = updater
        Section("Actualizaciones") {
            if updater.isAvailable {
                Toggle("Buscar actualizaciones automáticamente", isOn: $updater.automaticallyChecks)
                LabeledContent("Versión \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")") {
                    Button("Buscar ahora") { updater.checkForUpdates() }
                }
            } else {
                LabeledContent("Versión", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
                Text("Esta compilación no busca actualizaciones. Si la instalaste con Homebrew, usa brew upgrade --cask lost-and-prompt.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// Retención de Claude Code (`cleanupPeriodDays` en el `settings.json` de cada cuenta) y cuentas.
private struct HistorySettings: View {
    @Environment(AppModel.self) private var model
    @State private var choice = 180
    @State private var customDays = 90
    @State private var confirming = false
    /// Cuenta cuya retención se cambia.
    @State private var targetID = ""

    private var target: ClaudeAccount? {
        model.visibleAccounts.first { $0.id == targetID } ?? model.currentAccount ?? model.accounts.first
    }
    private var current: Int? { model.retention(of: target) }

    private let options = [30, 90, 180, 365]

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                if model.visibleAccounts.count > 1 {
                    Picker("Cuenta", selection: Binding(get: { target?.id ?? "" }, set: { targetID = $0 })) {
                        ForEach(model.visibleAccounts) { account in
                            Text(model.accountName(account.id)).tag(account.id)
                        }
                    }
                }
                Picker("Conservar sesiones", selection: $choice) {
                    Text("1 mes").tag(30)
                    Text("3 meses").tag(90)
                    Text("6 meses").tag(180)
                    Text("1 año").tag(365)
                    Divider()
                    Text("Personalizado").tag(0)
                }
                if choice == 0 {
                    Stepper(value: $customDays, in: 1...3650, step: 15) {
                        LabeledContent("Días", value: customDays.grouped)
                    }
                }
                LabeledContent("Ahora mismo") {
                    Text(current.map { "\($0) días" } ?? String(localized: "30 días (valor por defecto)"))
                }
            } header: {
                Text("Historial de Claude Code")
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Claude Code borra las sesiones más antiguas que este plazo. Lost & Prompt cambia el ajuste `cleanupPeriodDays` en el `settings.json` de la cuenta (`~/.claude` en la principal) y guarda antes una copia del archivo.")
                    HStack {
                        Spacer()
                        Button("Aplicar") { confirming = true }
                            .disabled(selectedDays == current)
                    }
                }
                .foregroundStyle(.secondary)
            }

            AccountsSection()

            Section("Lista") {
                Toggle("Ocultar sesiones vacías", isOn: $model.hideEmptySessions)
            }
        }
        .formStyle(.grouped)
        .onAppear(perform: showCurrent)
        .onChange(of: targetID) { showCurrent() }
        .confirmationDialog("¿Conservar las sesiones \(selectedDays) días?", isPresented: $confirming) {
            Button("Cambiar") { model.applyRetention(selectedDays, account: target) }
        } message: {
            Text("Se modificará \(Session.abbreviate(target?.settingsURL.path ?? "~/.claude/settings.json")). Se guardará una copia del archivo actual.")
        }
    }

    private var selectedDays: Int { choice == 0 ? customDays : choice }

    private func showCurrent() {
        choice = current.flatMap { options.contains($0) ? $0 : 0 } ?? 30
        if let current, !options.contains(current) { customDays = current }
    }
}

/// Cuentas de Claude Code: carpetas de configuración que se leen.
private struct AccountsSection: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Section {
            ForEach(model.accounts) { account in
                AccountRow(account: account)
            }
        } header: {
            Text("Cuentas de Claude Code")
        } footer: {
            VStack(alignment: .leading, spacing: 6) {
                Text("Cada carpeta de configuración de Claude Code (`~/.claude`, `~/.claude-trabajo`, la de `CLAUDE_CONFIG_DIR`…) es una cuenta con sus propias sesiones. Se detectan solas; cambia el nombre escribiendo encima.")
                HStack {
                    Spacer()
                    Button("Añadir carpeta…") { model.addAccount() }
                }
            }
            .foregroundStyle(.secondary)
        }
    }
}

private struct AccountRow: View {
    @Environment(AppModel.self) private var model
    let account: ClaudeAccount
    @State private var name = ""
    @FocusState private var editing: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                TextField("Nombre de la cuenta", text: $name, prompt: Text("Principal"))
                    .labelsHidden()
                    .textFieldStyle(.plain)
                    .fontWeight(.medium)
                    .focused($editing)
                    .onSubmit(save)
                    .onChange(of: editing) { _, now in if !now { save() } }
                let count = model.sessions.filter { $0.accountID == account.id && $0.userMessages > 0 }.count
                Text("\(Session.abbreviate(account.id)) · \(count) sesiones")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
            Spacer()
            if model.isManualAccount(account.id) {
                Button("Quitar") { model.removeAccount(account.id) }
            }
            if !account.isDefault {
                Toggle("Leer las sesiones de esta cuenta", isOn: Binding(
                    get: { !model.isHiddenAccount(account.id) },
                    set: { model.setAccount(account.id, hidden: !$0) }))
                    .labelsHidden()
                    .toggleStyle(.switch)
                    .help("Leer las sesiones de esta cuenta")
            }
        }
        .onAppear { name = model.accountName(account.id) == String(localized: "Principal") && account.isDefault ? "" : model.accountName(account.id) }
    }

    private func save() {
        let detected = account.detectedName
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        model.renameAccount(account.id, to: trimmed == detected ? "" : trimmed)
    }
}

private struct AppearanceSettings: View {
    @Environment(AppModel.self) private var model
    @AppStorage(AppAppearance.key) private var appearance = AppAppearance.system
    @State private var language = AppLanguage.current
    private let launchLanguage = AppLanguage.current

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Picker("Tema", selection: $appearance) {
                    Text("Sistema").tag(AppAppearance.system)
                    Text("Claro").tag(AppAppearance.light)
                    Text("Oscuro").tag(AppAppearance.dark)
                }
                .pickerStyle(.segmented)
                .onChange(of: appearance) { _, value in value.apply() }

                Picker("Idioma", selection: $language) {
                    Text("Sistema").tag(AppLanguage.system)
                    Text(verbatim: "Español").tag(AppLanguage.spanish)
                    Text(verbatim: "English").tag(AppLanguage.english)
                }
                .onChange(of: language) { _, value in value.save() }

                if language != launchLanguage {
                    HStack {
                        Text("El idioma cambia al reiniciar Lost & Prompt.")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("Reiniciar ahora") { AppLanguage.relaunch() }
                    }
                    .font(.callout)
                }
            }

            Section {
                Picker("Vista de la lista", selection: $model.listStyle) {
                    Label("Filas", systemImage: "list.bullet").tag(SessionListStyle.rows)
                    Label("Tarjetas", systemImage: "square.grid.2x2").tag(SessionListStyle.cards)
                }
                .pickerStyle(.inline)
            }
        }
        .formStyle(.grouped)
    }
}

#Preview {
    SettingsView().environment(MockData.model()).environment(AppUpdater())
}
