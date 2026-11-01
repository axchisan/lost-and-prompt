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
    /// Sesiones archivadas: no salen en Recientes, carpetas ni colecciones.
    var archived: Set<UUID> = []
    /// Carpetas («entornos») de cada colección: todas sus sesiones y las de sus subcarpetas, también
    /// las futuras, entran en la colección.
    var collectionFolders: [String: [String]] = [:]

    init() {}

    /// Los campos que falten (archivos de versiones anteriores) quedan vacíos: si la decodificación
    /// fallara entera, la app empezaría sin organización y la borraría al guardar.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        favorites = try c.decodeIfPresent(Set<UUID>.self, forKey: .favorites) ?? []
        customTitles = try c.decodeIfPresent([UUID: String].self, forKey: .customTitles) ?? [:]
        notes = try c.decodeIfPresent([UUID: String].self, forKey: .notes) ?? [:]
        collections = try c.decodeIfPresent([StoredCollection].self, forKey: .collections) ?? []
        memberships = try c.decodeIfPresent([String: [UUID]].self, forKey: .memberships) ?? [:]
        archived = try c.decodeIfPresent(Set<UUID>.self, forKey: .archived) ?? []
        collectionFolders = try c.decodeIfPresent([String: [String]].self, forKey: .collectionFolders) ?? [:]
    }
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
