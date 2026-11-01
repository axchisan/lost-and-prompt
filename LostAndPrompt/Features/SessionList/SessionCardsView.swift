import SwiftUI

/// Vista alternativa (dirección C): tarjetas agrupadas por día.
struct SessionCardsView: View {
    @Environment(AppModel.self) private var model

    private let columns = [GridItem(.adaptive(minimum: 220, maximum: 320), spacing: 14)]

    var body: some View {
        let sessions = model.visibleSessions
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 26) {
                ForEach(model.dayGroups(for: sessions)) { group in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(group.title).font(.title3.weight(.semibold))
                            Text(group.sessions.count == 1 ? "1 sesión" : "\(group.sessions.count) sesiones")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                        LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
                            ForEach(group.sessions) { session in
                                SessionCard(session: session, isSelected: model.selectedSessionID == session.id)
                                    .onTapGesture { model.selectedSessionID = session.id }
                                    .contextMenu { SessionContextMenu(session: session) }
                                    .onDrag { NSItemProvider(object: session.id.uuidString as NSString) }
                            }
                        }
                    }
                }
            }
            .padding(24)
        }
        .navigationTitle(model.sectionTitle)
        .navigationSubtitle(sessions.count == 1 ? "1 sesión" : "\(sessions.count) sesiones")
    }
}

struct SessionCard: View {
    @Environment(AppModel.self) private var model
    var session: Session
    var isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: session.isInHome ? "house" : "folder").foregroundStyle(.tint)
                Text(session.folderName).lineLimit(1)
                Spacer()
                Text(model.shortDate(session.lastActivity)).monospacedDigit()
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            Text(session.title)
                .font(.headline)
                .lineLimit(2, reservesSpace: true)

            Text(session.firstPrompt)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(2, reservesSpace: true)

            HStack(spacing: 6) {
                if session.isFavorite { Image(systemName: "star.fill").foregroundStyle(.yellow) }
                ForEach(session.allCollectionIDs, id: \.self) { id in
                    if let collection = model.collection(id) {
                        HStack(spacing: 4) { TintDot(tint: collection.tint, size: 7); Text(collection.name) }
                    }
                }
                Spacer()
                Text(session.userMessages == 1 ? "1 mensaje" : "\(session.userMessages.grouped) mensajes")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(.background.secondary, in: .rect(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 2.5)
        }
        .contentShape(.rect(cornerRadius: 12))
    }
}

#Preview("Tarjetas") {
    NavigationStack { SessionCardsView() }
        .environment(MockData.model())
        .frame(width: 900, height: 700)
}
