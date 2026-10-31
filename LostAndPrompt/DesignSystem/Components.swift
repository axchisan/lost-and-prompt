import SwiftUI

extension SessionCollection.Tint {
    var color: Color {
        switch self {
        case .red: .red
        case .orange: .orange
        case .yellow: .yellow
        case .green: .green
        case .teal: .teal
        case .blue: .blue
        case .indigo: .indigo
        case .purple: .purple
        case .gray: .gray
        }
    }
}

/// Punto de color de una colección, como las etiquetas de Finder.
struct TintDot: View {
    var tint: SessionCollection.Tint
    var size: CGFloat = 8

    var body: some View {
        Circle().fill(tint.color.gradient).frame(width: size, height: size)
    }
}

/// Avatar de un mensaje: el usuario en gris y Claude en el naranja de la marca.
struct MessageAvatar: View {
    var role: Message.Role

    var body: some View {
        Image(systemName: role == .user ? "person.fill" : "sparkle")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(Circle().fill(role == .user ? Color.gray.gradient : Color.claude.gradient))
    }
}

extension Color {
    static let claude = Color(red: 0.85, green: 0.47, blue: 0.34)
}

/// Fila de dato compacta del detalle: «348 mensajes», «US$ 38,34».
struct Fact: View {
    var value: String
    var label: LocalizedStringKey? = nil

    var body: some View {
        HStack(spacing: 4) {
            Text(value).fontWeight(.semibold).foregroundStyle(.primary).monospacedDigit()
            if let label { Text(label) }
        }
    }
}

extension Double {
    var usd: String { formatted(.currency(code: "USD")) }
}

extension Int {
    var grouped: String { formatted(.number) }
}

/// Fragmento de búsqueda con la coincidencia (marcada entre `\u{1}` y `\u{2}`) resaltada.
struct SnippetText: View {
    var snippet: String

    var body: some View {
        Text(attributed).lineLimit(2)
    }

    private var attributed: AttributedString {
        var result = AttributedString()
        var highlighted = false
        var current = ""
        func flush() {
            var piece = AttributedString(current)
            if highlighted {
                piece.backgroundColor = .yellow.opacity(0.35)
                piece.foregroundColor = .primary
            }
            result += piece
            current = ""
        }
        for character in snippet {
            if character == "\u{1}" { flush(); highlighted = true }
            else if character == "\u{2}" { flush(); highlighted = false }
            else { current.append(character) }
        }
        flush()
        return result
    }
}
