import Foundation

/// Organización propia del usuario: nunca se escribe en los archivos de Claude Code.
struct OrganizationData: Codable {
    struct StoredCollection: Codable {
        var id: String
        var name: String
        var tint: String
        var symbol: String
    }

    var favorites: Set<UUID> = []
    var customTitles: [UUID: String] = [:]
    var notes: [UUID: String] = [:]
    var collections: [StoredCollection] = []
    var memberships: [String: [UUID]] = [:]
}

enum OrganizationStore {
    static var url: URL {
        URL.applicationSupportDirectory.appending(path: "LostAndPrompt/organization.json")
    }

    static func load() -> OrganizationData {
        guard let data = try? Data(contentsOf: url) else { return OrganizationData() }
        return (try? JSONDecoder().decode(OrganizationData.self, from: data)) ?? OrganizationData()
    }

    static func save(_ organization: OrganizationData) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try? encoder.encode(organization).write(to: url, options: .atomic)
    }
}
