// Datos de ejemplo y Tauri simulado para grabar la interfaz real de la app en un navegador.
// Se inyecta antes de cargar la app (Playwright addInitScript). Nada de esto son sesiones reales.
// Idioma: window.__LP_LANG ("es" | "en"); plataforma: window.__LP_PLATFORM ("macos" | "windows").
(() => {
  const lang = window.__LP_LANG || "es";
  const platform = window.__LP_PLATFORM || "macos";
  const t = (es, en) => (lang === "en" ? en : es);
  const home = platform === "windows" ? "C:\\Users\\ana" : "/Users/ana";
  const sep = platform === "windows" ? "\\" : "/";
  const now = Date.now();
  const ago = (hours) => new Date(now - hours * 3600e3).toISOString();

  const collections = [
    { id: "client", name: t("Cliente Acme", "Acme client"), tint: "indigo" },
    { id: "oss", name: t("Código abierto", "Open source"), tint: "teal" },
    { id: "home", name: t("Casa y trámites", "Home & errands"), tint: "orange" },
    { id: "games", name: t("Juegos", "Games"), tint: "green" },
  ];

  let n = 0;
  const s = (title, folder, startedH, lastH, msgs, cost, extra = {}) => {
    n++;
    const cwd = folder ? home + sep + folder.split("/").join(sep) : home;
    const name = folder ? folder.split("/").pop() : "~";
    return {
      id: extra.id || `5e${String(n).padStart(2, "0")}c0de-1a2b-4c3d-8e9f-${String(1000 + n).padStart(12, "0")}`,
      title, aiTitle: title, customTitle: null, cwd, folderName: name,
      abbreviatedPath: folder ? "~" + sep + folder.split("/").join(sep) : "~", isHome: !folder,
      environment: null, gitBranch: extra.branch ?? (folder ? "main" : null),
      startedAt: ago(startedH), lastActivity: ago(lastH), userMessages: msgs, totalMessages: msgs * 13,
      costUsd: cost, model: extra.model || "Opus 5.5", isFavorite: !!extra.favorite, isArchived: false,
      collectionIds: extra.collections || [], folderCollectionIds: [], firstPrompt: extra.prompt || "",
      lastReply: extra.reply || null, folderExists: true, note: extra.note || null,
    };
  };

  const FEATURED = "8f9e3d39-c322-4188-9d82-a6facfd06679";
  const STRIPE = "3c1d2b7a-5e44-4f0a-9b1c-7d2e8f6a5b40";
  const sessions = [
    s(t("Migración del checkout a Stripe", "Checkout migration to Stripe"), "Developer/acme-store", 5, 0.2, 84, 9.8, { id: STRIPE, collections: ["client"], branch: "feat/stripe",
      prompt: t("Migra el checkout de PayPal a Stripe sin romper los pedidos guardados.", "Move the checkout from PayPal to Stripe without breaking saved orders."),
      reply: t("Listo: el webhook de Stripe ya confirma los pagos y los pedidos antiguos siguen intactos.", "Done: the Stripe webhook now confirms payments and old orders are untouched.") }),
    s(t("Tema oscuro para el blog", "Dark theme for the blog"), "Developer/blog", 7, 2.6, 41, 3.12, {
      prompt: t("Añade un tema oscuro al blog que respete la preferencia del sistema.", "Add a dark theme to the blog that follows the system setting.") }),
    s(t("Bot de speedrun para un juego de plataformas", "Speedrun bot for a platformer"), "Developer/platformer-bot", 30, 24.5, 212, 24.6, { id: FEATURED, favorite: true, collections: ["games"],
      prompt: t("¿Podemos automatizar el primer nivel del juego sin leer la pantalla?", "Can we automate the first level of the game without reading the screen?"),
      reply: t("Listo: el mod completa el nivel 1 en 2:41. Quedan los saltos dobles del nivel 2.", "Done: the mod clears level 1 in 2:41. Double jumps in level 2 are still pending.") }),
    s(t("Pruebas end-to-end del panel de Acme", "End-to-end tests for the Acme dashboard"), "Developer/acme-dashboard", 27, 26, 54, 3.45, { collections: ["client"],
      prompt: t("Escribe pruebas con Playwright para el flujo de facturación.", "Write Playwright tests for the billing flow.") }),
    s(t("Limpieza de ramas viejas en Git", "Clean up stale Git branches"), "", 28, 27.5, 25, 1.16, {
      prompt: t("Borra las ramas ya fusionadas de todos mis repositorios.", "Delete already-merged branches across all my repos.") }),
    s(t("Lanzamiento de la v2 de mi librería", "Shipping v2 of my library"), "Developer/tiny-date", 100, 50, 640, 31.2, { favorite: true, collections: ["oss"], branch: "release/v2",
      prompt: t("Prepara la v2: changelog, migración y publicación en npm.", "Get v2 ready: changelog, migration guide and npm release.") }),
    s(t("Responder issues pendientes", "Triage open issues"), "Developer/tiny-date", 120, 62, 180, 12.4, { collections: ["oss"],
      prompt: t("Resume los issues abiertos y propón cuáles cerrar.", "Summarize open issues and suggest which to close.") }),
    s(t("Webhook de pagos que falla en producción", "Payments webhook failing in production"), "Developer/acme-store", 75, 70, 66, 6.2, { collections: ["client"], branch: "fix/webhook",
      prompt: t("El webhook de Stripe devuelve 400 en producción pero no en local.", "The Stripe webhook returns 400 in production but not locally.") }),
    s(t("Comparar planes de energía solar", "Compare solar panel plans"), "Documents", 80, 78, 103, 4.72, { collections: ["home"],
      prompt: t("¿Me conviene instalar paneles solares con mi consumo?", "Do solar panels make sense with my usage?") }),
    s(t("Ordenar fotos del viaje", "Sort the trip photos"), "Pictures/trip-2026", 84, 81, 96, 5.1, {
      prompt: t("Agrupa las fotos del viaje por ciudad y quita las repetidas.", "Group the trip photos by city and remove duplicates.") }),
    s(t("Liberar espacio en el disco", "Free up disk space"), "Developer/scripts", 90, 88, 61, 5.4, { favorite: true,
      prompt: t("Mi disco está casi lleno, revisa qué puedo borrar sin riesgo.", "My disk is almost full, find what I can safely delete.") }),
    s(t("App del clima en SwiftUI", "Weather app in SwiftUI"), "Developer/weather-ios", 150, 148, 54, 6.94, { favorite: true,
      prompt: t("Una app del clima con widgets para la pantalla de inicio.", "A weather app with Home Screen widgets.") }),
    s(t("Rediseño del portafolio", "Portfolio redesign"), "Developer/portfolio", 300, 160, 410, 48.7, { favorite: true,
      prompt: t("Rediseña mi portafolio para conseguir clientes.", "Redesign my portfolio to win clients.") }),
    s(t("Configurar mis dotfiles", "Set up my dotfiles"), "Developer/dotfiles", 200, 197, 118, 9.3, {
      prompt: t("Organiza mis dotfiles con un script de instalación.", "Organize my dotfiles with an install script.") }),
    s(t("Experimento de clasificación de imágenes", "Image classification experiment"), "Developer/ml-lab", 480, 230, 320, 36.8, {
      prompt: t("Entrena un clasificador pequeño con mis fotos de plantas.", "Train a small classifier on my plant photos.") }),
    s(t("Refactor del carrito de compras", "Shopping cart refactor"), "Developer/acme-store", 400, 380, 150, 14.2, { collections: ["client"],
      prompt: t("Separa la lógica del carrito en un hook reutilizable.", "Extract the cart logic into a reusable hook.") }),
    s(t("Presupuesto del mes", "Monthly budget"), "", 700, 698, 40, 2.1, { collections: ["home"],
      prompt: t("Arma una hoja de presupuesto con mis gastos fijos.", "Build a budget sheet with my fixed expenses.") }),
    s(t("Migrar la API a Postgres", "Move the API to Postgres"), "Developer/acme-api", 900, 850, 260, 27.5, { collections: ["client"],
      prompt: t("Migra la API de MongoDB a Postgres con Prisma.", "Migrate the API from MongoDB to Postgres with Prisma.") }),
  ];

  const stripeConversation = [
    { role: "user", date: ago(5), toolCount: 0, thinking: false, text: t("Migra el checkout de PayPal a Stripe sin romper los pedidos guardados.", "Move the checkout from PayPal to Stripe without breaking saved orders.") },
    { role: "assistant", date: ago(4.98), toolCount: 6, thinking: false, text: t(
      "Revisé `checkout/` y los pedidos guardados. Plan:\n\n1. Crear el **PaymentIntent** en el servidor.\n2. Confirmar el pago con el **webhook** `payment_intent.succeeded`.\n3. Mantener `order.provider` para los pedidos antiguos de PayPal.",
      "I went through `checkout/` and the saved orders. Plan:\n\n1. Create the **PaymentIntent** on the server.\n2. Confirm payment with the `payment_intent.succeeded` **webhook**.\n3. Keep `order.provider` for old PayPal orders.") },
    { role: "assistant", date: ago(4.9), toolCount: 3, thinking: false, text: t("El webhook queda así:", "Here's the webhook:") +
      "\n\n```ts\nexport async function POST(req: Request) {\n  const event = stripe.webhooks.constructEvent(\n    await req.text(), req.headers.get(\"stripe-signature\")!, secret,\n  );\n  if (event.type === \"payment_intent.succeeded\") {\n    await orders.markPaid(event.data.object.metadata.orderId);\n  }\n  return new Response(null, { status: 200 });\n}\n```" },
    { role: "user", date: ago(0.4), toolCount: 0, thinking: false, text: t("¿Y los pedidos que ya estaban pagados con PayPal?", "What about orders already paid with PayPal?") },
    { role: "assistant", date: ago(0.2), toolCount: 2, thinking: false, text: t(
      "Siguen intactos. Comprobé los 1.284 pedidos:\n\n| Proveedor | Pedidos | Estado |\n|---|---|---|\n| PayPal | 1.284 | sin cambios |\n| Stripe | 37 | pagados |\n\nListo: el webhook de Stripe ya confirma los pagos y los pedidos antiguos siguen intactos.",
      "They're untouched. I checked all 1,284 orders:\n\n| Provider | Orders | Status |\n|---|---|---|\n| PayPal | 1,284 | unchanged |\n| Stripe | 37 | paid |\n\nDone: the Stripe webhook now confirms payments and old orders are untouched.") },
  ];
  const generic = (session) => [
    { role: "user", date: session.startedAt, toolCount: 0, thinking: false, text: session.firstPrompt || "…" },
    { role: "assistant", date: session.startedAt, toolCount: 5, thinking: false, text: t("Empiezo revisando el proyecto para entender cómo está organizado.", "I'll start by looking through the project to see how it's organized.") },
    { role: "assistant", date: session.lastActivity, toolCount: 2, thinking: false, text: session.lastReply || t("Hecho. Te dejo un resumen de los cambios.", "Done. Here's a summary of the changes.") },
  ];

  const hits = (query) => {
    const q = query.toLowerCase();
    const out = [];
    if (/stripe|webhook|pago|pay/.test(q)) {
      out.push({ sessionId: STRIPE, snippet: t("…el webhook de Stripe ya confirma los pagos…", "…the Stripe webhook now confirms payments…") });
      out.push({ sessionId: sessions[7].id, snippet: t("…el webhook de Stripe devuelve 400 en producción…", "…the Stripe webhook returns 400 in production…") });
    }
    for (const x of sessions) if (out.length < 8 && !out.some((h) => h.sessionId === x.id) && (x.title + " " + x.firstPrompt).toLowerCase().includes(q)) out.push({ sessionId: x.id, snippet: x.firstPrompt });
    return out;
  };

  const cbs = {};
  let next = 1;
  const listeners = {};
  window.__lpEmit = (event, payload) => (listeners[event] || []).forEach((h) => cbs[h]?.({ event, id: 1, payload }));
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
    transformCallback: (cb) => { const id = next++; cbs[id] = cb; return id; },
    unregisterCallback: (id) => delete cbs[id],
    convertFileSrc: (p) => p,
    invoke: async (cmd, args = {}) => {
      switch (cmd) {
        case "load_library": return { sessions, collections, collectionFolders: {}, retentionDays: 365, claudeFolderExists: true, platform, home };
        case "get_messages": return args.id === STRIPE ? stripeConversation : generic(sessions.find((x) => x.id === args.id) || sessions[0]);
        case "search": return hits(args.query || "");
        case "toggle_favorite": { const x = sessions.find((y) => y.id === args.id); x.isFavorite = !x.isFavorite; return x.isFavorite; }
        case "toggle_archive": return true;
        case "toggle_membership": { const x = sessions.find((y) => y.id === args.id); const has = x.collectionIds.includes(args.collection); x.collectionIds = has ? x.collectionIds.filter((c) => c !== args.collection) : [...x.collectionIds, args.collection]; return !has; }
        case "terminals": return [{ id: "warp", name: "Warp", installed: true }, { id: "terminal", name: "Terminal", installed: true }];
        case "editors": return [{ id: "cursor", name: "Cursor", installed: true }];
        case "plugin:event|listen": (listeners[args.event] ||= []).push(args.handler); return args.handler;
        case "plugin:updater|check": return null;
        case "plugin:app|version": return "0.7.0";
        case "plugin:clipboard-manager|write_text": return null;
        default: return null;
      }
    },
  };
  try {
    localStorage.setItem("prefs", JSON.stringify({ didShowWelcome: true, language: lang, theme: window.__LP_THEME || "light", terminal: "warp", autoUpdate: false }));
  } catch {}
  window.__LP_IDS = { STRIPE, FEATURED };
})();
