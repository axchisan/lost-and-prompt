import SwiftUI

/// «Aprende a usar Lost & Prompt»: guía de funciones, atajos y novedades de cada versión.
/// El contenido sale de `docs/guia/guia.json` y del `CHANGELOG.md`, empaquetados en la app: los
/// mismos que leen la app de Windows y Linux y la web.
enum GuideTab: String, Hashable { case guide, shortcuts, news }

struct GuideContent: Decodable {
    struct Text: Decodable {
        var es: String
        var en: String
        var localized: String { GuideContent.spanish ? es : en }
    }
    struct Keys: Decodable { var mac: String? }
    struct Item: Decodable, Identifiable {
        var id: String
        var since: String
        var only: String?
        var `try`: String?
        var keys: Keys?
        var title: Text
        var body: Text
    }
    struct Topic: Decodable, Identifiable {
        var id: String
        var title: Text
        var intro: Text
        var items: [Item]
    }
    struct Shortcut: Decodable {
        var label: Text
        var mac: String?
    }
    struct ShortcutGroup: Decodable {
        var title: Text
        var items: [Shortcut]
    }

    var topics: [Topic]
    var shortcuts: [ShortcutGroup]

    static var spanish: Bool { Bundle.main.preferredLocalizations.first?.hasPrefix("es") ?? true }

    /// La guía para Mac: sin lo que solo existe en Windows y Linux.
    static let shared: GuideContent = {
        guard let url = Bundle.main.url(forResource: "guia", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              var content = try? JSONDecoder().decode(GuideContent.self, from: data) else {
            return GuideContent(topics: [], shortcuts: [])
        }
        content.topics = content.topics.map { topic in
            var topic = topic
            topic.items = topic.items.filter { $0.only != "win" }
            return topic
        }
        content.shortcuts = content.shortcuts.map { group in
            ShortcutGroup(title: group.title, items: group.items.filter { $0.mac != nil })
        }.filter { !$0.items.isEmpty }
        return content
    }()

    /// Todas las versiones del CHANGELOG, de la más nueva a la más antigua.
    static let releases: [ReleaseNotes.Release] = {
        guard let url = Bundle.main.url(forResource: "CHANGELOG", withExtension: "md"),
              let text = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        let body = text.components(separatedBy: "\n")
            .filter { $0.firstMatch(of: #/^\[[^\]]+\]:\s*http/#) == nil }
            .joined(separator: "\n")
        return ReleaseNotes.parse(body)
    }()

    static var currentVersion: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "" }

    /// «Nuevo» marca lo que llegó en la versión menor que tienes (0.6.x en la 0.6.1).
    static func isNew(_ since: String) -> Bool {
        let minor = { (v: String) in v.split(separator: ".").prefix(2).joined(separator: ".") }
        return !currentVersion.isEmpty && minor(since) == minor(currentVersion)
    }

    static func matches(_ query: String, _ texts: String...) -> Bool {
        let haystack = texts.joined(separator: " ").localizedLowercase
        return query.localizedLowercase.split(separator: " ").allSatisfy { haystack.contains($0) }
    }
}

struct GuideView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Group {
            switch model.guideTab {
            case .guide: GuideTopicsView()
            case .shortcuts: GuideShortcutsView()
            case .news: GuideNewsView()
            }
        }
        .frame(minWidth: 720, minHeight: 480)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker("Sección", selection: $model.guideTab) {
                    Text("Guía").tag(GuideTab.guide)
                    Text("Atajos").tag(GuideTab.shortcuts)
                    Text("Novedades").tag(GuideTab.news)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .fixedSize()
            }
        }
    }
}

private struct NewBadge: View {
    var text: LocalizedStringKey
    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 1)
            .background(Color.accentColor.opacity(0.18), in: Capsule())
    }
}

private struct KeyCap: View {
    var keys: String
    var body: some View {
        Text(keys)
            .font(.callout.weight(.medium).monospaced())
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(.background, in: RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(.separator))
            .accessibilityLabel(Text("Atajo: \(keys)"))
    }
}

private struct GuideTopicsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openSettings) private var openSettings
    @Environment(\.openWindow) private var openWindow
    @State private var topicID: String? = GuideContent.shared.topics.first?.id
    @State private var query = ""

    private var shown: [GuideContent.Topic] {
        let topics = GuideContent.shared.topics
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return topics.filter { $0.id == topicID } }
        return topics.compactMap { topic in
            var topic = topic
            topic.items = topic.items.filter {
                GuideContent.matches(trimmed, $0.title.localized, $0.body.localized, $0.keys?.mac ?? "", topic.title.localized)
            }
            return topic.items.isEmpty ? nil : topic
        }
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $topicID) {
                ForEach(Array(GuideContent.shared.topics.enumerated()), id: \.element.id) { index, topic in
                    HStack {
                        Text("\(index + 1). \(topic.title.localized)")
                        Spacer()
                        if topic.items.contains(where: { GuideContent.isNew($0.since) }) { NewBadge(text: "Nuevo") }
                    }
                    .tag(topic.id)
                }
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 230)
            .onChange(of: topicID) { if topicID != nil { query = "" } }
        } detail: {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if shown.isEmpty {
                        Text("Nada coincide con «\(query)»").foregroundStyle(.secondary)
                    }
                    ForEach(shown) { topic in
                        VStack(alignment: .leading, spacing: 12) {
                            Text(topic.title.localized).font(.title.weight(.semibold))
                            if query.isEmpty {
                                Text(topic.intro.localized).foregroundStyle(.secondary)
                            }
                            ForEach(topic.items) { item in itemView(item) }
                        }
                    }
                }
                .padding(24)
                .frame(maxWidth: 760, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
            }
            .searchable(text: $query, placement: .toolbar, prompt: Text("Buscar en la guía"))
        }
    }

    private func itemView(_ item: GuideContent.Item) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Text(item.title.localized).font(.headline)
                if GuideContent.isNew(item.since) { NewBadge(text: "Nuevo en \(item.since)") }
                Spacer()
                if let keys = item.keys?.mac { KeyCap(keys: keys) }
            }
            Text(item.body.localized)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if let action = item.try {
                Button("Probar ahora") { run(action) }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.separator))
    }

    /// Abre la función en la ventana principal.
    private func run(_ action: String) {
        if action.hasPrefix("settings:") {
            UserDefaults.standard.set(String(action.dropFirst(9)), forKey: "settingsPane")
            openSettings()
            return
        }
        openWindow(id: "main")
        switch action {
        case "quick": model.isQuickOpenPresented = true
        case "newSession": model.isNewSessionPresented = true
        case "newCollection": model.isCreatingCollection = true
        case "importSession": model.importSession()
        case "activity": model.sidebarSelection = .activity
        default: break
        }
    }
}

private struct GuideShortcutsView: View {
    @State private var query = ""

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 32, alignment: .top)], alignment: .leading, spacing: 22) {
                ForEach(GuideContent.shared.shortcuts, id: \.title.en) { group in
                    let items = group.items.filter { query.isEmpty || GuideContent.matches(query, $0.label.localized, $0.mac ?? "") }
                    if !items.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(group.title.localized.uppercased())
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .padding(.bottom, 6)
                            ForEach(items, id: \.label.en) { item in
                                HStack {
                                    Text(item.label.localized)
                                    Spacer()
                                    KeyCap(keys: item.mac ?? "")
                                }
                                .padding(.vertical, 6)
                                .accessibilityElement(children: .combine)
                                Divider()
                            }
                        }
                    }
                }
            }
            .padding(24)
        }
        .searchable(text: $query, placement: .toolbar, prompt: Text("Buscar un atajo o una acción"))
    }
}

private struct GuideNewsView: View {
    @State private var selected: String? = GuideContent.releases.first?.version

    var body: some View {
        NavigationSplitView {
            List(GuideContent.releases, id: \.version, selection: $selected) { release in
                HStack {
                    Text(release.version)
                    Spacer()
                    if release.version == GuideContent.currentVersion {
                        Text("la que tienes").font(.caption).foregroundStyle(.secondary)
                    }
                }
                .tag(release.version)
            }
            .navigationSplitViewColumnWidth(min: 150, ideal: 170)
        } detail: {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 24) {
                        ForEach(GuideContent.releases, id: \.version) { release in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(alignment: .firstTextBaseline, spacing: 10) {
                                    Text("Lost & Prompt \(release.version)").font(.title2.weight(.semibold))
                                    if release.version == GuideContent.currentVersion {
                                        Text("la que tienes").foregroundStyle(.secondary)
                                    }
                                }
                                let notes = ReleaseNotes.inLanguage(release.notes, spanish: GuideContent.spanish)
                                MarkdownView(blocks: MarkdownBlock.blocks(notes.replacing(#/(?m)^### /#, with: "## ")), highlight: nil, idPrefix: release.version)
                                Divider().padding(.top, 8)
                            }
                            .id(release.version)
                        }
                    }
                    .padding(24)
                    .frame(maxWidth: 760, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                }
                .onChange(of: selected) {
                    if let selected { withAnimation { proxy.scrollTo(selected, anchor: .top) } }
                }
            }
        }
    }
}
