import SwiftUI

/// Estado de la app: sesiones de Claude Code, organización propia y preferencias.
@Observable
final class AppModel {
    var sessions: [Session]
    var collections: [SessionCollection]
    var messages: [Session.ID: [Message]]
    /// Última actividad de la sesión cuando se leyó su conversación: si cambia, hay que releerla.
    @ObservationIgnored private var messagesVersion: [Session.ID: Date] = [:]
    /// Referencia de «ahora» para agrupar por fecha (fija en los datos de ejemplo).
    var now: Date

    var sidebarSelection: SidebarItem? = .recents
    var selectedSessionID: Session.ID? { didSet { if oldValue != selectedSessionID { findIndex = 0 } } }
    var listStyle: SessionListStyle = .rows { didSet { save(listStyle.rawValue, "listStyle") } }
    var searchText = "" { didSet { scheduleContentSearch() } }

    // Filtros de la lista (no se guardan: al abrir la app se ve todo)
    var filterPeriod: DatePeriod = .all
    var filterFavoritesOnly = false
    var filterBranch: String?
    var isFiltering: Bool { filterPeriod != .all || filterFavoritesOnly || filterBranch != nil }

    func clearFilters() {
        filterPeriod = .all
        filterFavoritesOnly = false
        filterBranch = nil
    }

    /// Ramas de git de las sesiones, de la más usada a la menos (las 15 primeras).
    var branches: [String] {
        let counts = Dictionary(grouping: activeSessions.compactMap(\.gitBranch).filter { $0 != "HEAD" }, by: \.self).mapValues(\.count)
        return counts.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.prefix(15).map(\.key)
    }
    var isQuickOpenPresented = false
    var isNewSessionPresented = false
    /// Coincidencias dentro de las conversaciones para la búsqueda actual: sesión → fragmento.
    var contentHits: [Session.ID: String] = [:]
    /// Progreso de la primera indexación de mensajes (nil cuando no hay nada pendiente).
    var indexingProgress: (done: Int, total: Int)?

    // Preferencias (se guardan en UserDefaults cuando se usan datos reales)
    var terminal: TerminalApp = .warp { didSet { save(terminal.rawValue, "terminal") } }
    var extraArguments = "" { didSet { save(extraArguments, "extraArguments") } }
    var customTerminal = "" { didSet { save(customTerminal, "customTerminal") } }
    /// Editor para «Abrir en …» (nil si no hay ninguno conocido instalado).
    var editor: EditorApp? { didSet { save(editor?.rawValue ?? "", "editor") } }
    var retentionDays: Int? = 180
    var hideEmptySessions = true { didSet { save(hideEmptySessions, "hideEmptySessions") } }
    var showToolCalls = false
    var showThinking = false

    // Buscar dentro de la conversación abierta (⌘F)
    var isFindPresented = false
    var findText = "" { didSet { findIndex = 0 } }
    /// Coincidencia actual, contando desde 0 en el orden de la conversación.
    var findIndex = 0
    /// Coincidencias en la conversación abierta (lo actualiza el detalle).
    var findTotal = 0

    init(sessions: [Session], collections: [SessionCollection], messages: [Session.ID: [Message]], now: Date) {
        self.sessions = sessions
        self.collections = collections
        self.messages = messages
        self.now = now
    }

    // MARK: Consultas

    var selectedSession: Session? {
        guard let id = selectedSessionID else { return nil }
        return sessions.first { $0.id == id }
    }

    func collection(_ id: SessionCollection.ID) -> SessionCollection? {
        collections.first { $0.id == id }
    }

    func count(in collectionID: SessionCollection.ID) -> Int {
        activeSessions.filter { $0.collectionIDs.contains(collectionID) }.count
    }

    var favoritesCount: Int { activeSessions.filter(\.isFavorite).count }

    /// Las sesiones sin archivar: las que se ven en la lista, los contadores y los buscadores.
    var activeSessions: [Session] { sessions.filter { !$0.isArchived } }

    var archivedCount: Int { sessions.filter { $0.isArchived && (!hideEmptySessions || $0.userMessages > 0) }.count }

    /// Sesiones de la sección elegida en la barra lateral, filtradas por la búsqueda.
    var visibleSessions: [Session] {
        var result: [Session]
        switch sidebarSelection {
        case .favorites: result = activeSessions.filter(\.isFavorite)
        case .archived: result = sessions.filter(\.isArchived)
        case .collection(let id): result = activeSessions.filter { $0.collectionIDs.contains(id) }
        case .project(let path): result = activeSessions.filter { $0.cwd == path || $0.cwd.hasPrefix(path + "/") }
        default: result = activeSessions
        }
        if hideEmptySessions { result = result.filter { $0.userMessages > 0 } }
        if let start = filterPeriod.start(from: now) { result = result.filter { $0.lastActivity >= start } }
        if filterFavoritesOnly { result = result.filter(\.isFavorite) }
        if let branch = filterBranch { result = result.filter { $0.gitBranch == branch } }
        let query = searchText.trimmingCharacters(in: .whitespaces)
        if !query.isEmpty {
            result = result.filter {
                $0.title.localizedStandardContains(query)
                    || $0.cwd.localizedStandardContains(query)
                    || $0.firstPrompt.localizedStandardContains(query)
                    || contentHits[$0.id] != nil
            }
        }
        return result.sorted { $0.lastActivity > $1.lastActivity }
    }

    var sectionTitle: String {
        switch sidebarSelection {
        case .favorites: String(localized: "Favoritos")
        case .activity: String(localized: "Actividad")
        case .archived: String(localized: "Archivadas")
        case .collection(let id): collection(id)?.name ?? ""
        case .project(let path): path == Session.homePath ? String(localized: "Inicio") : (path as NSString).lastPathComponent
        default: String(localized: "Recientes")
        }
    }

    var folderCount: Int { Set(sessions.map(\.cwd)).count }

    // MARK: Agrupación por fecha

    struct DayGroup: Identifiable {
        var id: String { title }
        var title: String
        var sessions: [Session]
    }

    func dayGroups(for sessions: [Session]) -> [DayGroup] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        func bucket(_ date: Date) -> (Int, String) {
            let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: today).day ?? 0
            switch days {
            case ..<1: return (0, String(localized: "Hoy"))
            case 1: return (1, String(localized: "Ayer"))
            case 2..<7: return (2, String(localized: "Esta semana"))
            case 7..<31: return (3, String(localized: "Este mes"))
            default: return (4, String(localized: "Más antiguas"))
            }
        }
        let grouped = Dictionary(grouping: sessions) { bucket($0.lastActivity).0 }
        return grouped.keys.sorted().map { key in
            DayGroup(title: bucket(grouped[key]!.first!.lastActivity).1, sessions: grouped[key]!)
        }
    }

    /// Hora para hoy y ayer, día de la semana para esta semana, fecha corta para lo demás.
    func shortDate(_ date: Date) -> String {
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 0
        switch days {
        case ..<2: return date.formatted(date: .omitted, time: .shortened)
        case 2..<7: return date.formatted(.dateTime.weekday(.abbreviated))
        default: return date.formatted(.dateTime.day().month(.abbreviated))
        }
    }

    func relativeDay(_ date: Date) -> String {
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 0
        let time = date.formatted(date: .omitted, time: .shortened)
        switch days {
        case ..<1: return String(localized: "Hoy, \(time)")
        case 1: return String(localized: "Ayer, \(time)")
        default: return date.formatted(.dateTime.weekday(.wide).day().month(.wide)) + ", " + time
        }
    }

    // MARK: Árbol de proyectos

    /// Carpetas con sesiones, anidadas bajo su carpeta padre más cercana que también tenga sesiones.
    var projectTree: [ProjectNode] {
        let counts = Dictionary(grouping: activeSessions, by: \.cwd).mapValues(\.count)
        let paths = counts.keys.sorted()
        func name(_ path: String) -> String {
            path == Session.homePath ? String(localized: "Inicio") : (path as NSString).lastPathComponent
        }
        func children(of parent: String?) -> [ProjectNode]? {
            let direct = paths.filter { path in
                guard path != Session.homePath || parent == nil else { return false }
                let ancestors = paths.filter { $0 != path && path.hasPrefix($0 + "/") && $0 != Session.homePath }
                if let parent { return ancestors.max(by: { $0.count < $1.count }) == parent }
                return ancestors.isEmpty
            }
            guard !direct.isEmpty else { return nil }
            return direct.map { ProjectNode(path: $0, name: name($0), sessionCount: counts[$0] ?? 0, children: $0 == Session.homePath ? nil : children(of: $0)) }
                .sorted { $0.path == Session.homePath ? true : ($1.path == Session.homePath ? false : $0.name.localizedStandardCompare($1.name) == .orderedAscending) }
        }
        return children(of: nil) ?? []
    }

    // MARK: Carga de datos reales

    /// `false` en los datos de ejemplo: entonces no se lee ni se escribe nada en disco.
    var usesRealData = false
    var isLoading = false
    var errorMessage: String?
    var renamingSession: Session?
    var editingNoteFor: Session?
    var isCreatingCollection = false
    private var organization = OrganizationData()

    private let searchIndex = SearchIndex()
    private var watcher: FileWatcher?
    private var hotKey: GlobalHotKey?
    private var searchTask: Task<Void, Never>?
    private var indexTask: Task<Void, Never>?

    static func live() -> AppModel {
        let model = AppModel(sessions: [], collections: [], messages: [:], now: .now)
        let defaults = UserDefaults.standard
        model.terminal = defaults.string(forKey: "terminal").flatMap(TerminalApp.init).flatMap { $0.isInstalled ? $0 : nil }
            ?? TerminalApp.available.first ?? .terminal
        model.extraArguments = defaults.string(forKey: "extraArguments") ?? ""
        model.customTerminal = defaults.string(forKey: "customTerminal") ?? ""
        model.editor = defaults.string(forKey: "editor").flatMap(EditorApp.init).flatMap { $0.appURL != nil ? $0 : nil }
            ?? EditorApp.available.first
        model.hideEmptySessions = defaults.object(forKey: "hideEmptySessions") as? Bool ?? true
        model.listStyle = defaults.string(forKey: "listStyle").flatMap(SessionListStyle.init) ?? .rows
        model.retentionDays = ClaudeSettings.retentionDays()
        model.usesRealData = true
        // Solo para capturas: `-LPSearch texto` arranca con esa búsqueda.
        if let search = defaults.string(forKey: "LPSearch") { model.searchText = search }
        model.watcher = FileWatcher(url: ClaudeStore.projectsURL) { [weak model] in
            Task { await model?.reload() }
        }
        model.hotKey = GlobalHotKey { [weak model] in
            NSApp.activate()
            NSApp.windows.first { $0.identifier?.rawValue.contains("main") == true }?.makeKeyAndOrderFront(nil)
            model?.isQuickOpenPresented = true
        }
        return model
    }

    private func save(_ value: Any, _ key: String) {
        guard usesRealData else { return }
        UserDefaults.standard.set(value, forKey: key)
    }

    // MARK: Búsqueda en las conversaciones

    private func scheduleContentSearch() {
        searchTask?.cancel()
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard usesRealData, query.count >= 2 else { contentHits = [:]; return }
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            let hits = await searchIndex.search(query)
            guard !Task.isCancelled else { return }
            contentHits = Dictionary(hits.map { ($0.sessionID, $0.snippet) }, uniquingKeysWith: { a, _ in a })
        }
    }

    /// Búsqueda directa para el lanzador, que tiene su propio campo de texto.
    func searchContent(_ query: String) async -> [SearchIndex.Hit] {
        guard usesRealData else { return [] }
        return await searchIndex.search(query, limit: 8)
    }

    private func updateIndex(with summaries: [SessionSummary]) {
        indexTask?.cancel()
        indexTask = Task {
            let index = searchIndex
            await index.update(with: summaries) { done, total in
                Task { @MainActor [weak self] in
                    self?.indexingProgress = done < total ? (done, total) : nil
                }
            }
            indexingProgress = nil
            scheduleContentSearch()
        }
    }

    func reload() async {
        guard usesRealData, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        organization = OrganizationStore.load()
        let scanned = await ClaudeStore.scan()
        // Si una sesión se copió a otra carpeta (al reanudarla en otro sitio), queda la copia más reciente.
        let summaries = Dictionary(grouping: scanned, by: \.id).compactMap { $0.value.max { $0.modified < $1.modified } }
        now = .now
        collections = organization.collections.map {
            SessionCollection(id: $0.id, name: $0.name, tint: .init(rawValue: $0.tint) ?? .blue, symbol: $0.symbol)
        }
        // Las conversaciones ya leídas se conservan: si la sesión cambió, el detalle la relee al
        // verla (loadMessages compara la versión) y mientras tanto sigue mostrando la anterior.
        sessions = summaries.compactMap(makeSession)
        updateIndex(with: summaries)
        if selectedSessionID == nil || selectedSession == nil {
            selectedSessionID = visibleSessions.first?.id
        }
    }

    private func makeSession(_ summary: SessionSummary) -> Session? {
        guard let cwd = summary.cwd else { return nil }
        let id = summary.id
        return Session(
            id: id,
            aiTitle: summary.aiTitle ?? summary.firstPrompt.map { String($0.prefix(60)) } ?? String(localized: "Sesión sin título"),
            customTitle: organization.customTitles[id],
            cwd: cwd,
            gitBranch: summary.gitBranch,
            startedAt: summary.startedAt ?? summary.modified,
            lastActivity: summary.modified,
            userMessages: summary.userMessages,
            totalMessages: summary.userMessages + summary.assistantMessages,
            costUSD: summary.costUSD,
            model: Self.modelName(summary.model),
            isFavorite: organization.favorites.contains(id),
            isArchived: organization.archived.contains(id),
            collectionIDs: organization.memberships.compactMap { $0.value.contains(id) ? $0.key : nil }.sorted(),
            firstPrompt: summary.firstPrompt ?? "",
            lastReply: summary.lastReply,
            folderExists: FileManager.default.fileExists(atPath: cwd),
            note: organization.notes[id],
            filePath: summary.path)
    }

    /// `claude-opus-5-5` → «Opus 5.5».
    static func modelName(_ id: String?) -> String {
        guard let id, id.hasPrefix("claude-") else { return id ?? "—" }
        let parts = id.dropFirst("claude-".count).split(separator: "-")
        guard let family = parts.first else { return id }
        let version = parts.dropFirst().prefix { $0.allSatisfy(\.isNumber) && $0.count <= 2 }.joined(separator: ".")
        return family.capitalized + (version.isEmpty ? "" : " " + version)
    }

    func loadMessages(for session: Session) async {
        guard messages[session.id] == nil || messagesVersion[session.id] != session.lastActivity,
              let path = session.filePath else { return }
        let version = session.lastActivity
        let loaded = await Task.detached(priority: .userInitiated) { ClaudeStore.messages(at: path) }.value
        messages[session.id] = loaded
        messagesVersion[session.id] = version
    }

    // MARK: Acciones

    func resume(_ session: Session) {
        guard usesRealData else { return }
        do {
            try Launcher.resume(session, in: terminal, extraArguments: extraArguments, customTemplate: customTerminal)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Reanuda en otra carpeta cuando la original ya no existe. Claude Code busca la sesión en la
    /// carpeta de proyecto que corresponde al directorio, así que se copia allí el archivo.
    func chooseFolder(for session: Session) {
        guard usesRealData, let source = session.filePath else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.prompt = String(localized: "Reanudar aquí")
        panel.message = String(localized: "Elige la carpeta donde quieres reanudar «\(session.title)».")
        guard panel.runModal() == .OK, let folder = panel.url else { return }
        let encoded = folder.path.replacing(/[^A-Za-z0-9]/, with: "-")
        let destination = ClaudeStore.projectsURL.appending(path: encoded, directoryHint: .isDirectory)
        do {
            try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
            let target = destination.appending(path: (source as NSString).lastPathComponent)
            if !FileManager.default.fileExists(atPath: target.path) {
                try FileManager.default.copyItem(at: URL(filePath: source), to: target)
            }
            var moved = session
            moved.cwd = folder.path
            moved.folderExists = true
            resume(moved)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func revealInFinder(_ session: Session) {
        guard usesRealData else { return }
        Launcher.revealInFinder(session)
    }

    // MARK: Sesión nueva (⌘N)

    struct NewSessionFolder: Identifiable {
        var id: String { path }
        var path: String
        var sessionCount: Int
        var lastUsed: Date

        var name: String {
            path == Session.homePath ? String(localized: "Inicio") : (path as NSString).lastPathComponent
        }
    }

    /// Carpetas donde se abrió una sesión nueva desde la app: ruta → última vez.
    private var newSessionHistory: [String: Date] {
        get { UserDefaults.standard.dictionary(forKey: "newSessionFolders") as? [String: Date] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: "newSessionFolders") }
    }

    /// Para ⌘N: las carpetas con sesiones y las elegidas antes, las usadas más recientemente primero.
    var newSessionFolders: [NewSessionFolder] {
        let history = newSessionHistory
        var folders = Dictionary(grouping: activeSessions, by: \.cwd).compactMap { path, list -> NewSessionFolder? in
            guard list.contains(where: \.folderExists) else { return nil }
            let last = max(list.map(\.lastActivity).max() ?? .distantPast, history[path] ?? .distantPast)
            return NewSessionFolder(path: path, sessionCount: list.count, lastUsed: last)
        }
        let known = Set(folders.map(\.path))
        for (path, date) in history where !known.contains(path) && FileManager.default.fileExists(atPath: path) {
            folders.append(NewSessionFolder(path: path, sessionCount: 0, lastUsed: date))
        }
        return folders.sorted { $0.lastUsed > $1.lastUsed }
    }

    /// «Elegir otra carpeta…»: cualquier carpeta, tenga o no sesiones. Devuelve si se abrió.
    @discardableResult
    func chooseFolderForNewSession() -> Bool {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.prompt = String(localized: "Abrir sesión aquí")
        panel.message = String(localized: "Elige la carpeta donde abrir una sesión nueva de Claude Code.")
        guard panel.runModal() == .OK, let folder = panel.url else { return false }
        startNewSession(in: folder.path)
        return true
    }

    /// Abre Claude Code en la carpeta, sin reanudar nada.
    func startNewSession(in cwd: String) {
        guard usesRealData else { return }
        newSessionHistory[cwd] = .now
        do {
            let title = String(localized: "Nueva sesión en \((cwd as NSString).lastPathComponent)")
            try Launcher.newSession(in: cwd, title: title, terminal: terminal, extraArguments: extraArguments, customTemplate: customTerminal)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func openInEditor(_ cwd: String) {
        guard usesRealData, let editor else { return }
        do {
            try Launcher.open(cwd, in: editor)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func showFind() {
        guard selectedSession != nil else { return }
        isFindPresented = true
    }

    func moveFind(by step: Int) {
        guard findTotal > 0 else { return }
        findIndex = (findIndex + step + findTotal) % findTotal
    }

    func toggleFavorite(_ id: Session.ID) {
        guard let index = sessions.firstIndex(where: { $0.id == id }) else { return }
        sessions[index].isFavorite.toggle()
        if sessions[index].isFavorite { organization.favorites.insert(id) } else { organization.favorites.remove(id) }
        persist()
    }

    /// Archiva o recupera la sesión. Al archivar la elegida, pasa a la siguiente de la lista.
    func toggleArchive(_ id: Session.ID) {
        guard let index = sessions.firstIndex(where: { $0.id == id }) else { return }
        let list = visibleSessions
        sessions[index].isArchived.toggle()
        if sessions[index].isArchived { organization.archived.insert(id) } else { organization.archived.remove(id) }
        persist()
        if selectedSessionID == id, let position = list.firstIndex(where: { $0.id == id }) {
            let remaining = list.filter { $0.id != id }
            selectedSessionID = remaining.isEmpty ? nil : remaining[min(position, remaining.count - 1)].id
        }
    }

    func toggle(_ id: Session.ID, in collectionID: SessionCollection.ID) {
        guard let index = sessions.firstIndex(where: { $0.id == id }) else { return }
        var members = organization.memberships[collectionID] ?? []
        if let position = sessions[index].collectionIDs.firstIndex(of: collectionID) {
            sessions[index].collectionIDs.remove(at: position)
            members.removeAll { $0 == id }
        } else {
            sessions[index].collectionIDs.append(collectionID)
            members.append(id)
        }
        organization.memberships[collectionID] = members
        persist()
    }

    func rename(_ id: Session.ID, to title: String) {
        guard let index = sessions.firstIndex(where: { $0.id == id }) else { return }
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let custom = trimmed.isEmpty || trimmed == sessions[index].aiTitle ? nil : trimmed
        sessions[index].customTitle = custom
        organization.customTitles[id] = custom
        persist()
    }

    func setNote(_ id: Session.ID, to text: String) {
        guard let index = sessions.firstIndex(where: { $0.id == id }) else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        sessions[index].note = trimmed.isEmpty ? nil : trimmed
        organization.notes[id] = sessions[index].note
        persist()
    }

    /// `false` si no existe `~/.claude/projects` (Claude Code no instalado o nunca usado).
    var claudeFolderExists: Bool { FileManager.default.fileExists(atPath: ClaudeStore.projectsURL.path) }

    @discardableResult
    func createCollection(name: String, tint: SessionCollection.Tint) -> SessionCollection {
        let collection = SessionCollection(id: UUID().uuidString, name: name, tint: tint)
        collections.append(collection)
        organization.collections.append(.init(id: collection.id, name: name, tint: tint.rawValue, symbol: collection.symbol))
        persist()
        return collection
    }

    func deleteCollection(_ id: SessionCollection.ID) {
        collections.removeAll { $0.id == id }
        organization.collections.removeAll { $0.id == id }
        organization.memberships[id] = nil
        for index in sessions.indices { sessions[index].collectionIDs.removeAll { $0 == id } }
        if sidebarSelection == .collection(id) { sidebarSelection = .recents }
        persist()
    }

    func applyRetention(_ days: Int) {
        guard usesRealData else { retentionDays = days; return }
        do {
            try ClaudeSettings.setRetentionDays(days)
            retentionDays = ClaudeSettings.retentionDays()
        } catch {
            errorMessage = String(localized: "No se pudo cambiar el ajuste: \(error.localizedDescription)")
        }
    }

    private func persist() {
        guard usesRealData else { return }
        OrganizationStore.save(organization)
    }

    func copyResumeCommand(_ session: Session) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(session.resumeCommand, forType: .string)
    }

    func copySessionID(_ session: Session) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(session.id.uuidString.lowercased(), forType: .string)
    }
}
