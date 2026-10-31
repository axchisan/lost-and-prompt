// Imprime el ID de la ventana principal de una app (para `screencapture -l`).
import CoreGraphics
let owner = CommandLine.arguments.dropFirst().first ?? "Lost & Prompt"
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let title = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : nil
let windows = list.filter {
    ($0[kCGWindowOwnerName as String] as? String) == owner && ($0[kCGWindowLayer as String] as? Int) == 0
        && (title == nil || ($0[kCGWindowName as String] as? String) == title)
}
let biggest = windows.max { a, b in
    let ra = a[kCGWindowBounds as String] as? [String: Double] ?? [:], rb = b[kCGWindowBounds as String] as? [String: Double] ?? [:]
    return (ra["Width"] ?? 0) * (ra["Height"] ?? 0) < (rb["Width"] ?? 0) * (rb["Height"] ?? 0)
}
if let id = biggest?[kCGWindowNumber as String] as? Int { print(id) }
