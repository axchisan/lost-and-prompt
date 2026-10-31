import SwiftUI

/// Lanzador (dirección B): buscar y reanudar sin tocar el ratón.
struct QuickOpenView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var filter: String? = nil
    @State private var highlighted: Session.ID?
    @State private var realHits: [SearchIndex.Hit] = []
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(.secondary)
                TextField("Buscar sesiones y mensajes", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 22))
                    .focused($focused)
                    .onSubmit {
                        if let session = model.sessions.first(where: { $0.id == highlighted }) {
                            model.resume(session)
                            model.isQuickOpenPresented = false
                        }
                    }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)

            Divider()

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    chip(nil, title: String(localized: "Todas"))
                    chip("fav", title: String(localized: "Favoritos"), symbol: "star.fill")
                    ForEach(model.collections) { collection in
                        chip(collection.id, title: collection.name, tint: collection.tint)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }

            Divider()

            HStack(spacing: 0) {
                results
                    .frame(maxWidth: .infinity)
                Divider()
                preview
                    .frame(width: 320)
            }
            .frame(height: 380)

            Divider()

            HStack(spacing: 18) {
                Label("Se abrirá en \(model.terminal.resumeName)", systemImage: "terminal")
                Spacer()
                hint("↩", "Reanudar")
                hint("⌘↩", "Ver en la app")
                hint("⌘D", "Favorito")
                hint("⌘C", "Copiar comando")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
        }
        .frame(width: 820)
        .background(.regularMaterial, in: .rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(.separator.opacity(0.5)))
        .shadow(color: .black.opacity(0.25), radius: 40, y: 20)
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(150))
            realHits = query.count >= 2 ? await model.searchContent(query) : []
            if highlighted == nil || !(matches.contains { $0.id == highlighted } || messageHits.contains { $0.0.id == highlighted }) {
                highlighted = matches.first?.id ?? messageHits.first?.0.id
            }
        }
        .onAppear {
            if !model.usesRealData { query = "bot" }
            focused = true
            highlighted = matches.first?.id
        }
    }

    private var matches: [Session] {
        let base = model.sessions.filter { $0.userMessages > 0 }
        let filtered = base.filter { session in
            switch filter {
            case nil: true
            case "fav": session.isFavorite
            case let id?: session.collectionIDs.contains(id)
            }
        }
        guard !query.isEmpty else { return Array(filtered.sorted { $0.lastActivity > $1.lastActivity }.prefix(8)) }
        return filtered.filter { $0.title.localizedStandardContains(query) || $0.firstPrompt.localizedStandardContains(query) || $0.cwd.localizedStandardContains(query) }
            .sorted { $0.lastActivity > $1.lastActivity }
    }

    private var results: some View {
        List(selection: $highlighted) {
            Section("Sesiones") {
                ForEach(matches) { session in
                    QuickOpenRow(session: session, query: query)
                        .tag(session.id)
                }
            }
            Section("En mensajes") {
                ForEach(messageHits, id: \.0.id) { session, snippet in
                    QuickOpenRow(session: session, query: query, snippet: snippet)
                        .tag(session.id)
                }
            }
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
    }

    /// Coincidencias dentro del texto de las conversaciones (de ejemplo en esta fase).
    private var messageHits: [(Session, String)] {
        if model.usesRealData {
            let shown = Set(matches.map(\.id))
            return realHits.compactMap { hit in
                guard !shown.contains(hit.sessionID), let session = model.sessions.first(where: { $0.id == hit.sessionID }) else { return nil }
                return (session, hit.snippet.replacingOccurrences(of: "\u{1}", with: "").replacingOccurrences(of: "\u{2}", with: ""))
            }
        }
        // Datos de ejemplo para las capturas.
        guard query.lowercased() == "bot" else { return [] }
        let english = Locale.current.language.languageCode?.identifier == "en"
        let samples = english
            ? [("Free up disk space", "…the bot's build folder takes 2 GB…"), ("Set up my dotfiles", "…same as the bot's install script…")]
            : [("Liberar espacio en el disco", "…la carpeta del bot ocupa 2 GB…"), ("Configurar mis dotfiles", "…igual que el script del bot…")]
        return samples.compactMap { title, snippet in
            model.sessions.first { $0.title == title }.map { ($0, snippet) }
        }
    }

    @ViewBuilder private var preview: some View {
        if let session = model.sessions.first(where: { $0.id == highlighted }) {
            VStack(alignment: .leading, spacing: 12) {
                Label(session.abbreviatedPath, systemImage: session.isInHome ? "house" : "folder")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(session.title).font(.title3.weight(.semibold))
                HStack(spacing: 14) {
                    Text(model.relativeDay(session.lastActivity))
                    Fact(value: session.userMessages.grouped, label: "msj.")
                    if let cost = session.costUSD { Fact(value: cost.usd) }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                quote("Empezaste con", session.firstPrompt)
                if let reply = session.lastReply { quote("Lo último de Claude", reply) }
                Spacer()
            }
            .padding(20)
        } else {
            ContentUnavailableView("Sin selección", systemImage: "text.magnifyingglass")
        }
    }

    private func quote(_ title: LocalizedStringKey, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(text).font(.callout).lineLimit(4)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.5), in: .rect(cornerRadius: 10))
    }

    private func chip(_ id: String?, title: String, symbol: String? = nil, tint: SessionCollection.Tint? = nil) -> some View {
        let selected = filter == id
        return Button {
            filter = id
        } label: {
            HStack(spacing: 5) {
                if let symbol { Image(systemName: symbol).imageScale(.small) }
                if let tint { TintDot(tint: tint, size: 7) }
                Text(title)
            }
            .font(.callout)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(selected ? AnyShapeStyle(.tint) : AnyShapeStyle(.quaternary.opacity(0.6)), in: .capsule)
            .foregroundStyle(selected ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
        }
        .buttonStyle(.plain)
    }

    private func hint(_ key: String, _ label: LocalizedStringKey) -> some View {
        HStack(spacing: 5) {
            Text(key)
                .font(.caption.weight(.medium))
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(.quaternary.opacity(0.6), in: .rect(cornerRadius: 4))
            Text(label)
        }
    }
}

struct QuickOpenRow: View {
    @Environment(AppModel.self) private var model
    var session: Session
    var query: String
    var snippet: String? = nil

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: snippet == nil ? "terminal" : "text.bubble")
                .frame(width: 30, height: 30)
                .background(.quaternary.opacity(0.6), in: .rect(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(highlight(session.title)).fontWeight(.semibold).lineLimit(1)
                Text(snippet.map { "\(session.folderName) · " + $0 } ?? "\(session.folderName) · \(session.userMessages.grouped) mensajes")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(model.shortDate(session.lastActivity))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
    }

    private func highlight(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        if !query.isEmpty, let range = result.range(of: query, options: [.caseInsensitive, .diacriticInsensitive]) {
            result[range].backgroundColor = .yellow.opacity(0.45)
        }
        return result
    }
}

#Preview {
    QuickOpenView()
        .environment(MockData.model())
        .padding(40)
}
