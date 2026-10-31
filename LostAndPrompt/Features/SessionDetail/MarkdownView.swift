import SwiftUI

/// Un bloque de Markdown de un mensaje: lo que Claude Code escribe en sus respuestas.
enum MarkdownBlock: Hashable {
    case paragraph(String)
    case heading(level: Int, text: String)
    case code(language: String, text: String)
    /// `marker` es «•» o el número original («3.»); `level` la sangría.
    case list([ListItem])
    case quote(String)
    case table(header: [String], rows: [[String]])
    case rule

    struct ListItem: Hashable {
        var marker: String
        var level: Int
        var text: String
    }

    // MARK: Análisis

    private static var cache: [String: [MarkdownBlock]] = [:]

    static func blocks(_ text: String) -> [MarkdownBlock] {
        if let cached = cache[text] { return cached }
        if cache.count > 4000 { cache.removeAll() }
        let parsed = parse(text)
        cache[text] = parsed
        return parsed
    }

    static func parse(_ text: String) -> [MarkdownBlock] {
        let lines = text.components(separatedBy: "\n")
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        var index = 0

        func flush() {
            let joined = paragraph.joined(separator: "\n").trimmingCharacters(in: .newlines)
            if !joined.isEmpty { blocks.append(.paragraph(joined)) }
            paragraph.removeAll()
        }

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if let fence = ["```", "~~~"].first(where: trimmed.hasPrefix) {
                flush()
                let language = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                var code: [String] = []
                index += 1
                while index < lines.count, !lines[index].trimmingCharacters(in: .whitespaces).hasPrefix(fence) {
                    code.append(lines[index])
                    index += 1
                }
                blocks.append(.code(language: language, text: code.joined(separator: "\n")))
                index += 1
                continue
            }
            if trimmed.isEmpty {
                flush()
                index += 1
                continue
            }
            if let match = trimmed.wholeMatch(of: #/(#{1,6})\s+(.+?)\s*#*/#) {
                flush()
                blocks.append(.heading(level: match.1.count, text: String(match.2)))
                index += 1
                continue
            }
            if trimmed.wholeMatch(of: #/(-\s*){3,}|(\*\s*){3,}|(_\s*){3,}/#) != nil {
                flush()
                blocks.append(.rule)
                index += 1
                continue
            }
            if trimmed.hasPrefix(">") {
                flush()
                var quote: [String] = []
                while index < lines.count, case let current = lines[index].trimmingCharacters(in: .whitespaces), current.hasPrefix(">") {
                    quote.append(String(current.dropFirst()).trimmingCharacters(in: .whitespaces))
                    index += 1
                }
                blocks.append(.quote(quote.joined(separator: "\n")))
                continue
            }
            if listItem(line) != nil {
                flush()
                var items: [ListItem] = []
                while index < lines.count {
                    if let item = listItem(lines[index]) {
                        items.append(item)
                    } else if !items.isEmpty, lines[index].hasPrefix("  "),
                              case let continuation = lines[index].trimmingCharacters(in: .whitespaces), !continuation.isEmpty {
                        items[items.count - 1].text += "\n" + continuation
                    } else {
                        break
                    }
                    index += 1
                }
                blocks.append(.list(items))
                continue
            }
            if trimmed.hasPrefix("|"), index + 1 < lines.count, isTableSeparator(lines[index + 1]) {
                flush()
                let header = cells(trimmed)
                var rows: [[String]] = []
                index += 2
                while index < lines.count, case let row = lines[index].trimmingCharacters(in: .whitespaces), row.hasPrefix("|") {
                    rows.append(cells(row))
                    index += 1
                }
                blocks.append(.table(header: header, rows: rows))
                continue
            }
            paragraph.append(line)
            index += 1
        }
        flush()
        return blocks
    }

    private static func listItem(_ line: String) -> ListItem? {
        guard let match = line.wholeMatch(of: #/( *)([-*+]|\d{1,3}[.)])\s+(.*)/#) else { return nil }
        let marker = String(match.2)
        return ListItem(marker: marker.first?.isNumber == true ? marker.replacing(")", with: ".") : "•",
                        level: match.1.count / 2, text: String(match.3))
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.contains("-") && trimmed.wholeMatch(of: #/\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?/#) != nil
    }

    private static func cells(_ row: String) -> [String] {
        var parts = row.split(separator: "|", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        if parts.first?.isEmpty == true { parts.removeFirst() }
        if parts.last?.isEmpty == true { parts.removeLast() }
        return parts
    }

    // MARK: Texto que se muestra

    /// Los textos del bloque en el orden en que se ven, para contar coincidencias.
    var segments: [AttributedString] {
        switch self {
        case .paragraph(let text), .heading(_, let text), .quote(let text): [Self.inline(text)]
        case .code(_, let text): [AttributedString(text)]
        case .list(let items): items.map { Self.inline($0.text) }
        case .table(let header, let rows): (header + rows.flatMap(\.self)).map(Self.inline)
        case .rule: []
        }
    }

    private static var inlineCache: [String: AttributedString] = [:]

    /// Negrita, cursiva, `código` y enlaces dentro de una línea.
    static func inline(_ text: String) -> AttributedString {
        if let cached = inlineCache[text] { return cached }
        if inlineCache.count > 8000 { inlineCache.removeAll() }
        let rendered = (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(text)
        inlineCache[text] = rendered
        return rendered
    }
}

// MARK: - Resaltado de la búsqueda

/// Qué resaltar en un texto: todas las coincidencias de `query` y, en otro color, la número `current`.
struct FindHighlight {
    var query: String
    /// Ordinal de la coincidencia actual relativo al inicio de este texto (puede quedar fuera).
    var current: Int

    static func ranges(of query: String, in text: String) -> [Range<String.Index>] {
        guard !query.isEmpty else { return [] }
        var result: [Range<String.Index>] = []
        var start = text.startIndex
        while start < text.endIndex,
              let range = text.range(of: query, options: [.caseInsensitive, .diacriticInsensitive], range: start..<text.endIndex) {
            result.append(range)
            start = range.upperBound
        }
        return result
    }

    static func count(_ query: String, in segments: [AttributedString]) -> Int {
        segments.reduce(0) { $0 + ranges(of: query, in: String($1.characters)).count }
    }

    func apply(to text: AttributedString) -> AttributedString {
        var text = text
        let plain = String(text.characters)
        for (ordinal, range) in Self.ranges(of: query, in: plain).enumerated() {
            guard let target = Range(NSRange(range, in: plain), in: text) else { continue }
            if ordinal == current {
                text[target].backgroundColor = .orange
                text[target].foregroundColor = .black
            } else {
                text[target].backgroundColor = .yellow.opacity(0.4)
            }
        }
        return text
    }

    func shifted(by count: Int) -> FindHighlight { FindHighlight(query: query, current: current - count) }
}

// MARK: - Vista

/// El texto de un mensaje con sus bloques de Markdown.
struct MarkdownView: View {
    var blocks: [MarkdownBlock]
    var highlight: FindHighlight?
    /// Prefijo para el id de cada bloque, para poder desplazarse hasta la coincidencia actual.
    var idPrefix: String

    var body: some View {
        let counts = highlight.map { highlight in blocks.map { FindHighlight.count(highlight.query, in: $0.segments) } }
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                let before = counts.map { $0.prefix(index).reduce(0, +) } ?? 0
                BlockView(block: block, highlight: highlight?.shifted(by: before))
                    .id("\(idPrefix)-\(index)")
            }
        }
    }
}

private struct BlockView: View {
    var block: MarkdownBlock
    var highlight: FindHighlight?

    var body: some View {
        switch block {
        case .paragraph(let text):
            Text(styled(MarkdownBlock.inline(text))).lineSpacing(2)
        case .heading(let level, let text):
            Text(styled(MarkdownBlock.inline(text)))
                .font(level == 1 ? .title2.weight(.bold) : level == 2 ? .title3.weight(.semibold) : .headline)
                .padding(.top, 4)
        case .code(let language, let text):
            CodeBlockView(language: language, code: text, styled: styled(AttributedString(text)))
        case .list(let items):
            VStack(alignment: .leading, spacing: 5) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(item.marker)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                            .frame(minWidth: 14, alignment: .trailing)
                        Text(styled(MarkdownBlock.inline(item.text), skipping: items.prefix(index).map(\.text)))
                            .lineSpacing(2)
                    }
                    .padding(.leading, CGFloat(item.level) * 18)
                }
            }
        case .quote(let text):
            HStack(alignment: .top, spacing: 10) {
                RoundedRectangle(cornerRadius: 1.5).fill(.tertiary).frame(width: 3)
                Text(styled(MarkdownBlock.inline(text))).foregroundStyle(.secondary).lineSpacing(2)
            }
            .fixedSize(horizontal: false, vertical: true)
        case .table(let header, let rows):
            TableBlockView(header: header, rows: rows, highlight: highlight)
        case .rule:
            Divider().padding(.vertical, 2)
        }
    }

    /// Aplica el resaltado. `skipping` son los textos anteriores dentro del mismo bloque (listas).
    private func styled(_ text: AttributedString, skipping previous: [String] = []) -> AttributedString {
        guard var highlight else { return text }
        let before = FindHighlight.count(highlight.query, in: previous.map(MarkdownBlock.inline))
        highlight = highlight.shifted(by: before)
        return highlight.apply(to: text)
    }
}

private struct CodeBlockView: View {
    var language: String
    var code: String
    var styled: AttributedString
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(language.isEmpty ? String(localized: "Código") : language)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(code, forType: .string)
                    copied = true
                    Task {
                        try? await Task.sleep(for: .seconds(1.5))
                        copied = false
                    }
                } label: {
                    Label(copied ? "Copiado" : "Copiar", systemImage: copied ? "checkmark" : "doc.on.doc")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .help("Copiar el código")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            Divider()
            ScrollView(.horizontal) {
                Text(styled)
                    .font(.system(.callout, design: .monospaced))
                    .textSelection(.enabled)
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(12)
            }
            .scrollIndicators(.automatic)
        }
        .background(.quaternary.opacity(0.35), in: .rect(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(.separator))
    }
}

private struct TableBlockView: View {
    var header: [String]
    var rows: [[String]]
    var highlight: FindHighlight?

    var body: some View {
        let cells = header + rows.flatMap(\.self)
        // Las celdas hacen salto de línea dentro del ancho del mensaje: Claude escribe notas largas.
        Grid(alignment: .topLeading, horizontalSpacing: 14, verticalSpacing: 8) {
            GridRow {
                ForEach(Array(header.enumerated()), id: \.offset) { column, text in
                    cell(styled(text, at: column, in: cells)).fontWeight(.semibold)
                }
            }
            Divider().gridCellUnsizedAxes(.horizontal)
            ForEach(Array(rows.enumerated()), id: \.offset) { row, values in
                GridRow {
                    ForEach(Array(values.enumerated()), id: \.offset) { column, text in
                        cell(styled(text, at: header.count + rows.prefix(row).reduce(0) { $0 + $1.count } + column, in: cells))
                    }
                }
                if row < rows.count - 1 { Divider().opacity(0.5).gridCellUnsizedAxes(.horizontal) }
            }
        }
        .font(.callout)
        .padding(.vertical, 2)
    }

    private func cell(_ text: AttributedString) -> some View {
        Text(text).fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
    }

    private func styled(_ text: String, at position: Int, in cells: [String]) -> AttributedString {
        let rendered = MarkdownBlock.inline(text)
        guard let highlight else { return rendered }
        let before = FindHighlight.count(highlight.query, in: cells.prefix(position).map(MarkdownBlock.inline))
        return highlight.shifted(by: before).apply(to: rendered)
    }
}
