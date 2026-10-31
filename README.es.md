<p align="center">
  <img src="docs/diseno/icono/icono-caja-1024.png" width="128" alt="Ícono de Lost & Prompt: una caja de cartón con una tarjeta de terminal asomando">
</p>

<h1 align="center">Lost & Prompt</h1>

<p align="center"><em>Every Claude Code session you ever lost, found.</em></p>

<p align="center"><a href="README.md">Read in English</a></p>

Lost & Prompt es una app para **macOS, Windows y Linux** que sirve para **encontrar, organizar y
reanudar** todas tus sesiones de Claude Code, sin importar en qué carpeta las abriste. En Mac es
nativa en SwiftUI; en Windows y Linux usa Tauri + Rust, con el mismo diseño.

Claude Code guarda cada sesión ligada a su directorio, y `/resume` solo muestra por defecto las de
la carpeta actual. Cuando trabajas en muchas carpetas, recordar dónde hablaste de algo se vuelve
difícil. Lost & Prompt las reúne todas en una sola ventana.

![Ventana principal de Lost & Prompt](docs/screenshots/es/recents-light.png)

## Qué hace

- **Encontrar**: todas las sesiones de todas las carpetas, agrupadas por día. Busca en títulos,
  carpetas y en las propias conversaciones, con el fragmento resaltado.
- **Reanudar**: un clic (o ↩) abre la sesión en su carpeta original, en tu terminal: Warp,
  Terminal, iTerm2, Ghostty, Windows Terminal, PowerShell, GNOME Terminal, Konsole, Kitty,
  WezTerm… o cualquier otra con un comando personalizado.
- **Búsqueda rápida desde cualquier app**: ⌥⌘K en Mac, Ctrl+Alt+K en Windows y Linux, y un ícono
  en la barra de menús o la bandeja con tus sesiones recientes.
- **WSL**: en Windows también encuentra las sesiones de Claude Code dentro de WSL.
- **Organizar**: favoritos, nombres propios, colecciones y notas, sin tocar los archivos de
  Claude Code.
- **Leer**: la conversación sin ruido técnico antes de reanudarla.
- **Actividad**: costo, sesiones y carpetas con más uso.
- **Conservar tu historial**: Claude Code borra las sesiones de más de 30 días por defecto. Desde
  Ajustes eliges cuánto tiempo guardarlas.
- Filas o tarjetas, modo claro y oscuro, español e inglés. Se actualiza sola mientras usas
  Claude Code.
- **Actualizaciones automáticas** en las tres plataformas.

| Tarjetas | Búsqueda rápida | Modo oscuro |
|---|---|---|
| ![Vista de tarjetas](docs/screenshots/es/cards-light.png) | ![Búsqueda rápida](docs/screenshots/es/quickopen-light.png) | ![Modo oscuro](docs/screenshots/es/recents-dark.png) |

## Instalación

Descárgala desde [Releases](https://github.com/axchisan/lost-and-prompt/releases/latest). Una vez
instalada, Lost & Prompt se actualiza sola.

### macOS

macOS 15 Sequoia o superior, Apple Silicon o Intel.

```bash
brew install --cask axchisan/tap/lost-and-prompt
```

O descarga `LostAndPrompt-<versión>-macos-universal.dmg` y arrastra la app a Aplicaciones.

No está notarizada por Apple (eso exige una cuenta de desarrollador de pago), así que la primera vez
macOS dirá que no puede verificar al desarrollador. Ábrela una vez y ve a **Ajustes del Sistema →
Privacidad y seguridad → Abrir igualmente**, o ejecuta
`xattr -dr com.apple.quarantine "/Applications/Lost & Prompt.app"`. Homebrew lo hace por ti.

### Windows

Windows 10 u 11 (x64). Descarga `LostAndPrompt-<versión>-windows-x64-setup.exe` y ejecútalo; se
instala para tu usuario, sin permisos de administrador. El instalador no está firmado, así que
SmartScreen mostrará «Windows protegió su PC»: pulsa **Más información → Ejecutar de todas formas**.

### Linux

x86_64. Elige uno:

```bash
# AppImage (se actualiza sola)
chmod +x LostAndPrompt-*-linux-x86_64.AppImage && ./LostAndPrompt-*-linux-x86_64.AppImage

# Debian, Ubuntu, Mint…
sudo apt install ./LostAndPrompt-*-linux-amd64.deb

# Fedora, openSUSE…
sudo dnf install ./LostAndPrompt-*-linux-x86_64.rpm
```

## Privacidad

Lost & Prompt funciona solo en tu equipo. Lee las sesiones de Claude Code (`~/.claude/projects`, o
`%USERPROFILE%\.claude\projects` en Windows) sin modificarlas y no las envía a ningún sitio; la única
conexión es la que comprueba si hay versiones nuevas en GitHub Releases. El único archivo de Claude Code que puede cambiar es `~/.claude/settings.json`, y
solo cuando tú cambias el ajuste de historial; antes guarda una copia.

## Compilar

**App de Mac** (SwiftUI): macOS 15+, Xcode 26+ y [XcodeGen](https://github.com/yonaskolb/XcodeGen).

```bash
brew install xcodegen
xcodegen generate
open LostAndPrompt.xcodeproj
```

**App de Windows y Linux** (Tauri 2 + Rust; también corre en macOS para desarrollar): Rust, Node 24
y pnpm.

```bash
cd desktop
pnpm install
pnpm tauri dev
```

El núcleo compartido en Rust está en `core/` (`cargo test -p lost-and-prompt-core`). Las versiones
las compila GitHub Actions al subir una etiqueta `vX.Y.Z` (`scripts/bump-version.sh`). La documentación de diseño y las decisiones del
proyecto están en [`docs/`](docs/README.md).

## Licencia

[MIT](LICENSE). Lost & Prompt es un proyecto independiente, sin relación con Anthropic. Claude es
una marca de Anthropic, PBC.
