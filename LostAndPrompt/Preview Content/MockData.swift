import Foundation

/// Datos de ejemplo ficticios para las previews y las capturas (`-LPMock YES`).
/// Se muestran en inglés o en español según el idioma del sistema.
enum MockData {
    static let now: Date = date("2026-10-30 21:40")

    private static var english: Bool { Locale.current.language.languageCode?.identifier == "en" }

    private static func t(_ es: String, _ en: String) -> String { english ? en : es }

    static var collections: [SessionCollection] {
        [
            .init(id: "client", name: t("Cliente Acme", "Acme client"), tint: .indigo, symbol: "briefcase"),
            .init(id: "oss", name: t("Código abierto", "Open source"), tint: .teal, symbol: "chevron.left.forwardslash.chevron.right"),
            .init(id: "home", name: t("Casa y trámites", "Home & errands"), tint: .orange, symbol: "house"),
            .init(id: "games", name: t("Juegos", "Games"), tint: .green, symbol: "gamecontroller"),
        ]
    }

    static let featuredID = UUID(uuidString: "8F9E3D39-C322-4188-9D82-A6FACFD06679")!

    static var sessions: [Session] {
        [
            s(t("Migración del checkout a Stripe", "Checkout migration to Stripe"), "/Developer/acme-store", "2026-10-30 18:02", "2026-10-30 21:35", 84, 1_420, 9.80, collections: ["client"],
              prompt: t("Migra el checkout de PayPal a Stripe sin romper los pedidos guardados.", "Move the checkout from PayPal to Stripe without breaking saved orders.")),
            s(t("Tema oscuro para el blog", "Dark theme for the blog"), "/Developer/blog", "2026-10-30 16:10", "2026-10-30 19:00", 41, 610, 3.12,
              prompt: t("Añade un tema oscuro al blog que respete la preferencia del sistema.", "Add a dark theme to the blog that follows the system setting.")),
            Session(id: featuredID, aiTitle: t("Bot de speedrun para un juego de plataformas", "Speedrun bot for a platformer"),
                    cwd: home + "/Developer/platformer-bot", gitBranch: "main",
                    startedAt: date("2026-10-29 14:02"), lastActivity: date("2026-10-29 20:45"),
                    userMessages: 212, totalMessages: 2_980, costUSD: 24.60, model: "Opus 5.5",
                    isFavorite: true, collectionIDs: ["games"],
                    firstPrompt: t("¿Podemos automatizar el primer nivel del juego sin leer la pantalla?", "Can we automate the first level of the game without reading the screen?"),
                    lastReply: t("Listo: el mod completa el nivel 1 en 2:41. Quedan pendientes los saltos dobles del nivel 2.", "Done: the mod clears level 1 in 2:41. Double jumps in level 2 are still pending.")),
            s(t("Limpieza de ramas viejas en Git", "Clean up stale Git branches"), "", "2026-10-29 17:20", "2026-10-29 18:02", 25, 410, 1.16,
              prompt: t("Borra las ramas ya fusionadas de todos mis repositorios.", "Delete already-merged branches across all my repos.")),
            s(t("Revisar la factura de internet", "Check the internet bill"), "", "2026-10-29 15:10", "2026-10-29 15:49", 24, 380, 0.91, collections: ["home"],
              prompt: t("¿Por qué subió la factura de internet este mes?", "Why did my internet bill go up this month?")),
            s(t("Atajo para grabar la pantalla", "Screen recording shortcut"), "", "2026-10-29 15:20", "2026-10-29 15:22", 1, 12, 0.27,
              prompt: t("Quiero un atajo que grabe los últimos 30 segundos de pantalla.", "I want a shortcut that records the last 30 seconds of my screen.")),
            s(t("Pruebas end-to-end del panel de Acme", "End-to-end tests for the Acme dashboard"), "/Developer/acme-dashboard", "2026-10-28 18:40", "2026-10-28 19:35", 54, 820, 3.45, collections: ["client"],
              prompt: t("Escribe pruebas con Playwright para el flujo de facturación.", "Write Playwright tests for the billing flow.")),
            s(t("Lanzamiento de la v2 de mi librería", "Shipping v2 of my library"), "/Developer/tiny-date", "2026-10-26 09:00", "2026-10-28 17:49", 640, 8_400, 31.20, favorite: true, collections: ["oss"],
              prompt: t("Prepara la v2: changelog, migración y publicación en npm.", "Get v2 ready: changelog, migration guide and npm release.")),
            s(t("Responder issues pendientes", "Triage open issues"), "/Developer/tiny-date", "2026-10-25 10:00", "2026-10-28 08:02", 180, 2_300, 12.40, collections: ["oss"],
              prompt: t("Resume los issues abiertos y propón cuáles cerrar.", "Summarize open issues and suggest which to close.")),
            s(t("Comparar planes de energía solar", "Compare solar panel plans"), "/Documents", "2026-10-27 18:30", "2026-10-27 19:59", 103, 1_350, 4.72, collections: ["home"],
              prompt: t("¿Me conviene instalar paneles solares con mi consumo?", "Do solar panels make sense with my usage?")),
            s(t("Ordenar fotos del viaje", "Sort the trip photos"), "/Pictures/trip-2026", "2026-10-27 15:00", "2026-10-27 18:51", 96, 1_200, 5.10,
              prompt: t("Agrupa las fotos del viaje por ciudad y quita las repetidas.", "Group the trip photos by city and remove duplicates.")),
            s(t("Liberar espacio en el disco", "Free up disk space"), "/Developer/scripts", "2026-10-27 07:40", "2026-10-27 08:31", 61, 940, 5.40, favorite: true,
              prompt: t("Mi disco está casi lleno, revisa qué puedo borrar sin riesgo.", "My disk is almost full, find what I can safely delete.")),
            s(t("App del clima en SwiftUI", "Weather app in SwiftUI"), "/Developer/weather-ios", "2026-10-24 18:10", "2026-10-24 19:37", 54, 760, 6.94, favorite: true,
              prompt: t("Una app del clima con widgets para la pantalla de inicio.", "A weather app with Home Screen widgets.")),
            s(t("Rediseño del portafolio", "Portfolio redesign"), "/Developer/portfolio", "2026-10-20 10:00", "2026-10-24 18:16", 410, 5_600, 48.70, favorite: true,
              prompt: t("Rediseña mi portafolio para conseguir clientes.", "Redesign my portfolio to win clients.")),
            s(t("Configurar mis dotfiles", "Set up my dotfiles"), "/Developer/dotfiles", "2026-10-22 15:00", "2026-10-22 17:49", 118, 1_700, 9.30,
              prompt: t("Organiza mis dotfiles con un script de instalación.", "Organize my dotfiles with an install script.")),
            s(t("Experimento de clasificación de imágenes", "Image classification experiment"), "/Developer/ml-lab", "2026-10-15 09:00", "2026-10-21 19:56", 320, 4_100, 36.80,
              prompt: t("Entrena un clasificador pequeño con mis fotos de plantas.", "Train a small classifier on my plant photos.")),
            s(t("Presupuesto del mes", "Monthly budget"), "", "2026-10-04 11:38", "2026-10-04 14:03", 40, 520, 2.10, collections: ["home"],
              prompt: t("Arma una hoja de presupuesto con mis gastos fijos.", "Build a budget sheet with my fixed expenses.")),
            s(t("(sin título)", "(untitled)"), "/Developer", "2026-10-21 23:03", "2026-10-21 23:03", 0, 2, nil, prompt: ""),
        ]
    }

    static var messages: [Session.ID: [Message]] {
        [
            featuredID: [
                .init(role: .user, date: date("2026-10-29 14:02"),
                      text: t("¿Podemos automatizar el primer nivel del juego sin leer la pantalla? Tengo el juego abierto; revisa qué motor usa.",
                              "Can we automate the first level without reading the screen? The game is open; check which engine it uses.")),
                .init(role: .assistant, date: date("2026-10-29 14:03"),
                      text: t("Voy a revisar primero el proceso del juego, dónde está instalado y qué motor usa. De eso depende qué tipo de bot se puede hacer.",
                              "First I'll look at the game process, where it's installed and which engine it uses. That decides what kind of bot is possible."),
                      toolCount: 4),
                .init(role: .assistant, date: date("2026-10-29 14:06"),
                      text: t("Sí se puede. El camino más fiable es un **mod dentro del juego**, no un bot que mire la pantalla.\n\n- Usa Unity, así que BepInEx sirve para cargar el mod.\n- Todavía no he instalado nada.",
                              "Yes. The most reliable route is an **in-game mod**, not a bot that watches the screen.\n\n- It runs on Unity, so BepInEx can load the mod.\n- I haven't installed anything yet.")),
                .init(role: .user, date: date("2026-10-29 14:10"), text: t("Dale, hazlo con el mod.", "Go ahead with the mod.")),
                .init(role: .assistant, date: date("2026-10-29 20:45"),
                      text: t("Listo: el mod completa el nivel 1 en 2:41. Quedan pendientes los saltos dobles del nivel 2.\n\n| Nivel | Tiempo | Estado |\n|---|---|---|\n| 1 | 2:41 | Completo |\n| 2 | — | Faltan los saltos dobles |\n\nPara probarlo:\n\n```bash\ncp -r build/SpeedrunMod BepInEx/plugins/\n```",
                              "Done: the mod clears level 1 in 2:41. Double jumps in level 2 are still pending.\n\n| Level | Time | Status |\n|---|---|---|\n| 1 | 2:41 | Done |\n| 2 | — | Double jumps pending |\n\nTo try it:\n\n```bash\ncp -r build/SpeedrunMod BepInEx/plugins/\n```"),
                      toolCount: 37),
            ]
        ]
    }

    static func model() -> AppModel {
        let model = AppModel(sessions: sessions, collections: collections, messages: messages, now: now)
        model.selectedSessionID = featuredID
        return model
    }

    // MARK: Ayudantes

    private static let home = NSHomeDirectory()

    private static func s(_ title: String, _ relativePath: String, _ start: String, _ end: String,
                          _ userMessages: Int, _ total: Int, _ cost: Double?,
                          favorite: Bool = false, collections: [String] = [], prompt: String) -> Session {
        Session(id: UUID(), aiTitle: title, cwd: home + relativePath, gitBranch: "main",
                startedAt: date(start), lastActivity: date(end),
                userMessages: userMessages, totalMessages: total, costUSD: cost, model: "Opus 5.5",
                isFavorite: favorite, collectionIDs: collections, firstPrompt: prompt)
    }

    private static func s(_ title: String, _ relativePath: String, _ start: String, _ end: String,
                          _ userMessages: Int, _ total: Int, _ cost: Double?,
                          prompt: String, collections: [String]) -> Session {
        s(title, relativePath, start, end, userMessages, total, cost, favorite: false, collections: collections, prompt: prompt)
    }

    private static func date(_ string: String) -> Date {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.date(from: string)!
    }
}
