# Kit de promoción

Textos listos para copiar y pegar. Enlaces que se repiten:

- Sitio: <https://lostandprompt.axchisan.com/>
- Repo: <https://github.com/axchisan/lost-and-prompt>
- Imagen: `site/og.png` · capturas: `docs/screenshots/`

## Consejos

- **Un sitio por día**, no todo a la vez: así puedes contestar los comentarios, que es lo que hace
  que una publicación suba.
- Mejor de martes a jueves, entre las 8:00 y las 11:00 hora del este de EE. UU. (7:00–10:00 en
  Colombia).
- Responde rápido y sin ponerte a la defensiva. Si alguien encuentra un fallo, abre un issue y
  enlázalo.
- Casi todas las comunidades castigan la autopromoción si parece un anuncio. Escribe en primera
  persona, cuenta por qué la hiciste y deja claro que es gratis y de código abierto.
- Un GIF o vídeo corto arriba del todo multiplica los clics.

## Orden sugerido

1. r/ClaudeAI (la comunidad más grande y la del público exacto)
2. awesome-claude-code (formulario de issue, desde el 2026-11-14)
3. Show HN
4. r/ClaudeCode, r/macapps, r/opensource
5. X / Bluesky / LinkedIn
6. Comunidades en español
7. Product Hunt (cuando haya un par de estrellas y algún comentario que citar)

---

## Reddit — r/ClaudeAI

Flair: *Built with Claude* o *Productivity* (según lo que permita el subreddit).

**Título:** I built a free app to find and resume every Claude Code session, from every folder

**Texto:**

> Claude Code saves each session next to the folder you opened it in, and `/resume` only shows the
> current folder. After a few months across a dozen projects I kept asking myself "which folder did
> I talk about this in?", so I built **Lost & Prompt**.
>
> - Every session from every folder in one window, grouped by day
> - Search inside the conversations, not just titles
> - Resume in its original folder with one click, in your terminal (Warp, iTerm2, Ghostty, Windows
>   Terminal, Konsole…)
> - Favorites, custom names, collections and notes, without touching Claude Code's files
> - Global shortcut and menu bar / tray
> - Warns you that Claude Code deletes sessions after 30 days and lets you change it
>
> Native SwiftUI on the Mac, Tauri + Rust on Windows and Linux. Free, MIT, nothing leaves your
> machine (the only network call is the update check).
>
> Install: `brew install --cask axchisan/tap/lost-and-prompt` · Scoop on Windows · AppImage/deb/rpm
> on Linux.
>
> https://github.com/axchisan/lost-and-prompt
>
> Feedback very welcome, especially from Linux users. It's my first public app.

## Reddit — r/ClaudeCode

Mismo texto, con este título: **Tired of `/resume` only showing the current folder? I made a
session manager for Claude Code (free, open source)**

## Reddit — r/macapps

**Título:** [Free] Lost & Prompt — a native SwiftUI browser for your Claude Code sessions

> A small native Mac app (~3 MB, SwiftUI, Sparkle updates) that lists every Claude Code session on
> your Mac, lets you search inside them and resume any of them in Warp, Terminal, iTerm2 or Ghostty
> in one click. Three-column layout like Mail, ⌥⌘K quick search from anywhere, menu bar extra,
> light/dark, English/Spanish. MIT licensed.
>
> `brew install --cask axchisan/tap/lost-and-prompt`
>
> https://lostandprompt.axchisan.com/

## Hacker News — Show HN

**Título:** Show HN: Lost & Prompt – find and resume every Claude Code session on your machine

**URL:** el repositorio. **Primer comentario** (publícalo tú justo después):

> Hi HN. Claude Code stores each session as a JSONL file under `~/.claude/projects/<folder>`, and
> its `/resume` picker only shows sessions for the current directory. I work across many folders, so
> I kept losing conversations.
>
> Lost & Prompt indexes all of them and lets you search the full text, then resumes a session with
> `claude --resume <id>` in its original directory, in whatever terminal you use.
>
> Some details that might be interesting:
>
> - The Mac app is SwiftUI; Windows and Linux use Tauri 2 with a shared Rust core. Both are checked
>   against the same 83 real sessions to produce identical results.
> - Scanning went from 331 s to ~4 s on 1 GB of sessions by memory-mapping files and using `memchr`
>   to skip lines that can't matter before parsing JSON.
> - Full-text search is SQLite FTS5.
> - It never writes to Claude Code's files. The one exception is `cleanupPeriodDays` in
>   `settings.json` (Claude Code deletes sessions older than 30 days by default), and only when you
>   ask, with a backup.
>
> MIT licensed. Happy to answer questions.

## awesome-claude-code (formulario de issue)

Repositorio: <https://github.com/hesreallyhim/awesome-claude-code> (unas 57 000 estrellas). Reglas
de su `CONTRIBUTING.md`:

- **Solo con el formulario de issue desde la web**, nunca con un PR: lo cierran y pueden bloquearte.
- El repo debe tener **14 días desde el primer commit** (el historial empieza el 2026-10-31, así que
  a partir del **2026-11-14**) y commits posteriores, o tener 100 estrellas.
- Un recurso por vez.

Descripción para el formulario:

```markdown
- [Lost & Prompt](https://github.com/axchisan/lost-and-prompt) - Desktop app (macOS, Windows, Linux) to search every Claude Code session across all folders and resume it in your terminal with one click. Collections, notes, global shortcut and history retention settings.
```

## X / Bluesky

> Claude Code's `/resume` only shows sessions from the current folder.
>
> So I built Lost & Prompt: every session from every folder in one window, full-text search, and
> one-click resume in your terminal.
>
> Free and open source for macOS, Windows and Linux.
>
> https://lostandprompt.axchisan.com/

Adjunta el GIF o `site/og.png`. Etiqueta a `@claudeai` solo si el texto no parece pedir que lo
compartan.

## LinkedIn

> Acabo de publicar mi primera app de código abierto: **Lost & Prompt**.
>
> Uso Claude Code a diario en muchos proyectos, y cada sesión queda guardada en la carpeta donde la
> abrí. Encontrar una conversación de hace semanas significaba ir carpeta por carpeta.
>
> Lost & Prompt las reúne todas: búsqueda dentro de las conversaciones, reanudar con un clic en la
> terminal, colecciones y notas. Es nativa en SwiftUI para Mac y usa Tauri + Rust en Windows y Linux,
> con instaladores, actualizaciones firmadas y publicación automática desde GitHub Actions.
>
> Es gratis: https://lostandprompt.axchisan.com/

## Comunidades en español

Para Discord/Telegram de desarrolladores, r/programacion, r/devsarg, r/colombia_dev, etc.

> Hice una app gratuita y de código abierto para quienes usan **Claude Code**: reúne todas tus
> sesiones de todas las carpetas, las buscas por lo que se dijo y las reanudas en tu terminal con
> un clic. Funciona en macOS, Windows y Linux, y está en español.
>
> https://lostandprompt.axchisan.com/
>
> Si la pruebas, me encantaría saber qué le falta.

## Product Hunt

- **Nombre:** Lost & Prompt
- **Tagline (60):** Find and resume every Claude Code session, from any folder
- **Descripción:** Claude Code ties every session to the folder you opened it in. Lost & Prompt
  brings them all into one window: search inside conversations, resume in your terminal with one
  click, and organize with favorites, collections and notes. Free and open source for macOS,
  Windows and Linux.
- **Temas:** Developer Tools, Productivity, Open Source, Artificial Intelligence
- **Galería:** `site/og.png` + `recents-light`, `quickopen-light`, `cards-light`, la de Windows en
  oscuro y `activity-light`.
- **Primer comentario:** versión corta del texto de Show HN.

## dev.to / Medium (artículo)

**Título:** How I made a Claude Code session scanner 80× faster with memchr and mmap

Un artículo técnico atrae más que un anuncio: cuenta el problema, el primer enfoque (parsear cada
línea JSON), la medición (331 s) y el cambio (mmap + `memmem` para saltar líneas irrelevantes, rayon
para paralelizar, FTS5 para buscar), con el resultado (~4 s). Cierra con un enlace a la app.
