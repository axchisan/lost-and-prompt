import ServiceManagement
import SwiftUI

struct SettingsView: View {
    enum Pane: Hashable { case general, history, appearance }

    /// `-LPSettingsPane history|appearance` abre esa pestaña (para capturas).
    @State private var pane: Pane = Self.initialPane

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
                    ForEach(TerminalApp.allCases) { Text($0.displayName).tag($0) }
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

/// Retención de Claude Code: `cleanupPeriodDays` en `~/.claude/settings.json`.
private struct HistorySettings: View {
    @Environment(AppModel.self) private var model
    @State private var choice = 180
    @State private var customDays = 90
    @State private var confirming = false

    private let options = [30, 90, 180, 365]

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
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
                    Text(model.retentionDays.map { "\($0) días" } ?? String(localized: "30 días (valor por defecto)"))
                }
            } header: {
                Text("Historial de Claude Code")
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Claude Code borra las sesiones más antiguas que este plazo. Lost & Prompt cambia el ajuste `cleanupPeriodDays` en `~/.claude/settings.json` y guarda antes una copia del archivo.")
                    HStack {
                        Spacer()
                        Button("Aplicar") { confirming = true }
                            .disabled(selectedDays == model.retentionDays)
                    }
                }
                .foregroundStyle(.secondary)
            }

            Section("Lista") {
                Toggle("Ocultar sesiones vacías", isOn: $model.hideEmptySessions)
            }
        }
        .formStyle(.grouped)
        .onAppear { choice = model.retentionDays.flatMap { options.contains($0) ? $0 : 0 } ?? 30 }
        .confirmationDialog("¿Conservar las sesiones \(selectedDays) días?", isPresented: $confirming) {
            Button("Cambiar") { model.applyRetention(selectedDays) }
        } message: {
            Text("Se modificará ~/.claude/settings.json. Se guardará una copia del archivo actual.")
        }
    }

    private var selectedDays: Int { choice == 0 ? customDays : choice }
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
    SettingsView().environment(MockData.model())
}
