<p align="center">
  <img src="docs/diseno/icono/icono-caja-1024.png" width="128" alt="Ícono de Lost & Prompt: una caja de cartón con una tarjeta de terminal asomando">
</p>

<h1 align="center">Lost & Prompt</h1>

<p align="center"><em>Every Claude Code session you ever lost, found.</em></p>

<p align="center"><a href="README.md">Read in English</a></p>

Lost & Prompt es una app nativa de macOS para **encontrar, organizar y reanudar** todas tus
sesiones de Claude Code, sin importar en qué carpeta las abriste.

Claude Code guarda cada sesión ligada a su directorio, y `/resume` solo muestra por defecto las de
la carpeta actual. Cuando trabajas en muchas carpetas, recordar dónde hablaste de algo se vuelve
difícil. Lost & Prompt las reúne todas en una sola ventana.

![Ventana principal de Lost & Prompt](docs/screenshots/es/recents-light.png)

## Qué hace

- **Encontrar**: todas las sesiones de todas las carpetas, agrupadas por día. Busca en títulos,
  carpetas y en las propias conversaciones, con el fragmento resaltado.
- **Reanudar**: un clic (o ↩) abre la sesión en Warp, Terminal, iTerm2 o Ghostty, en su carpeta
  original.
- **Búsqueda rápida desde cualquier app**: pulsa ⌥⌘K, escribe dos letras y ↩.
- **Organizar**: favoritos, nombres propios, colecciones y notas, sin tocar los archivos de
  Claude Code.
- **Leer**: la conversación sin ruido técnico antes de reanudarla.
- **Actividad**: costo, sesiones y carpetas con más uso.
- **Conservar tu historial**: Claude Code borra las sesiones de más de 30 días por defecto. Desde
  Ajustes eliges cuánto tiempo guardarlas.
- Filas o tarjetas, modo claro y oscuro, español e inglés. Se actualiza sola mientras usas
  Claude Code.

| Tarjetas | Búsqueda rápida | Modo oscuro |
|---|---|---|
| ![Vista de tarjetas](docs/screenshots/es/cards-light.png) | ![Búsqueda rápida](docs/screenshots/es/quickopen-light.png) | ![Modo oscuro](docs/screenshots/es/recents-dark.png) |

## Instalación

Necesita macOS 15 Sequoia o superior (Apple Silicon o Intel).

**Homebrew**

```bash
brew install --cask axchisan/tap/lost-and-prompt
```

**Descarga**: baja el `.dmg` desde [Releases](https://github.com/axchisan/lost-and-prompt/releases)
y arrastra Lost & Prompt a Aplicaciones.

### La primera vez que la abres

Lost & Prompt es gratis y de código abierto, y no está notarizada por Apple (eso exige una cuenta
de desarrollador de pago). La primera vez, macOS dirá que no puede verificar al desarrollador.
Para permitirla:

1. Abre Lost & Prompt una vez y cierra el aviso.
2. Ve a **Ajustes del Sistema → Privacidad y seguridad**, baja y pulsa **Abrir igualmente**.

O ejecuta esto una vez en la Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Lost & Prompt.app"
```

El cask de Homebrew lo hace por ti.

## Privacidad

Lost & Prompt funciona solo en tu Mac. Lee `~/.claude/projects` sin modificarlo y no envía nada a
ningún sitio. El único archivo de Claude Code que puede cambiar es `~/.claude/settings.json`, y
solo cuando tú cambias el ajuste de historial; antes guarda una copia.

## Compilar

Requisitos: macOS 15+, Xcode 16+ y [XcodeGen](https://github.com/yonaskolb/XcodeGen).

```bash
brew install xcodegen
xcodegen generate
open LostAndPrompt.xcodeproj
```

`scripts/release.sh` genera el `.dmg` universal. La documentación de diseño y las decisiones del
proyecto están en [`docs/`](docs/README.md).

## Licencia

[MIT](LICENSE). Lost & Prompt es un proyecto independiente, sin relación con Anthropic. Claude es
una marca de Anthropic, PBC.
