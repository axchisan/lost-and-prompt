import AppKit

/// Notas de las versiones publicadas: el appcast trae las últimas del CHANGELOG (texto plano, con
/// «## [x.y.z] - fecha» por versión) y el aviso enseña las posteriores a la instalada, en el idioma
/// de la app. Así quien se salta varias versiones ve lo que trajo cada una.
enum ReleaseNotes {
    struct Release {
        var version: String
        var notes: String
    }

    static func parse(_ text: String) -> [Release] {
        var releases: [Release] = []
        for line in text.components(separatedBy: "\n") {
            if let match = line.wholeMatch(of: #/## \[(\d+\.\d+\.\d+)\].*/#) {
                releases.append(Release(version: String(match.1), notes: ""))
            } else if !releases.isEmpty {
                releases[releases.count - 1].notes += line + "\n"
            }
        }
        return releases
    }

    /// `true` si la versión `a` es posterior a `b` (x.y.z).
    static func isNewer(_ a: String, than b: String) -> Bool {
        a.compare(b, options: .numeric) == .orderedDescending
    }

    /// Las notas en un idioma. El CHANGELOG trae los dos: con títulos en cada idioma
    /// («### Added» / «### Añadido») o inglés y español separados por `---`; las más antiguas, solo inglés.
    static func inLanguage(_ notes: String, spanish: Bool) -> String {
        let lines = notes.components(separatedBy: "\n")
        if let separator = lines.firstIndex(where: { $0.trimmingCharacters(in: .whitespaces) == "---" }) {
            return (spanish ? lines[(separator + 1)...] : lines[..<separator]).joined(separator: "\n")
        }
        let english = #/^###\s+(Added|Changed|Fixed|Removed|Deprecated|Security)\b/#
        let spanishHeading = #/^###\s+(Añadido|Cambiado|Corregido|Eliminado|Obsoleto|Seguridad)\b/#
        guard lines.contains(where: { $0.firstMatch(of: spanishHeading) != nil }) else { return notes }
        var keep = true
        return lines.filter { line in
            if line.firstMatch(of: english) != nil { keep = !spanish }
            else if line.firstMatch(of: spanishHeading) != nil { keep = spanish }
            return keep
        }.joined(separator: "\n")
    }

    /// El texto que muestra el aviso: cada versión posterior a `current`, con su título.
    static func text(from appcastText: String, since current: String) -> NSAttributedString? {
        let spanish = Bundle.main.preferredLocalizations.first?.hasPrefix("es") ?? true
        let releases = parse(appcastText).filter { isNewer($0.version, than: current) }
        guard !releases.isEmpty else { return nil }

        let result = NSMutableAttributedString()
        let body = NSFont.systemFont(ofSize: NSFont.systemFontSize)
        func append(_ string: String, font: NSFont, color: NSColor = .labelColor, indent: CGFloat = 0, spacingBefore: CGFloat = 0) {
            let paragraph = NSMutableParagraphStyle()
            paragraph.headIndent = indent
            paragraph.firstLineHeadIndent = indent > 0 ? 4 : 0
            if indent > 0 { paragraph.tabStops = [NSTextTab(textAlignment: .left, location: indent)] }
            paragraph.paragraphSpacingBefore = spacingBefore
            paragraph.paragraphSpacing = 3
            result.append(NSAttributedString(string: string + "\n", attributes: [.font: font, .foregroundColor: color, .paragraphStyle: paragraph]))
        }
        if releases.count > 1 {
            let summary = String(localized: "\(releases.count) versiones nuevas desde la \(current):")
            append(summary, font: .boldSystemFont(ofSize: NSFont.systemFontSize))
        }
        for release in releases {
            append("Lost & Prompt \(release.version)", font: .boldSystemFont(ofSize: 15), spacingBefore: result.length > 0 ? 10 : 0)
            var item: String?
            func flush() {
                if let text = item { append("•\t" + plain(text), font: body, indent: 16) }
                item = nil
            }
            for line in inLanguage(release.notes, spanish: spanish).components(separatedBy: "\n") {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if line.hasPrefix("### ") {
                    flush()
                    append(String(line.dropFirst(4)), font: .boldSystemFont(ofSize: NSFont.systemFontSize), spacingBefore: 4)
                } else if line.hasPrefix("- ") {
                    flush()
                    item = String(line.dropFirst(2))
                } else if line.hasPrefix("  "), item != nil, !trimmed.isEmpty {
                    item! += " " + trimmed
                } else if !trimmed.isEmpty {
                    flush()
                    append(plain(trimmed), font: body, color: .secondaryLabelColor)
                } else {
                    flush()
                }
            }
            flush()
        }
        return result
    }

    /// Sin las marcas de Markdown en línea (`código`, **negrita**).
    private static func plain(_ text: String) -> String {
        text.replacing("**", with: "").replacing("`", with: "")
    }
}
