# Contribuir a Lost & Prompt

¡Gracias por tu interés! Cualquier ayuda suma: reportar fallos, proponer ideas, traducir, mejorar la
documentación o enviar código. *English speakers: issues and pull requests in English are welcome.*

## Antes de empezar

- **Fallos e ideas**: abre un [issue](https://github.com/axchisan/lost-and-prompt/issues/new/choose)
  con la plantilla correspondiente. Para preguntas y conversaciones, usa
  [Discussions](https://github.com/axchisan/lost-and-prompt/discussions).
- **Cambios grandes**: cuéntalo primero en un issue para acordar el enfoque antes de escribir código.
- **Privacidad**: nunca adjuntes sesiones reales de Claude Code ni capturas con datos personales. Para
  reproducir un fallo, usa una carpeta de prueba con `CLAUDE_CONFIG_DIR` o las sesiones ficticias de
  `core/tests/fixtures`.

## Estructura del proyecto

| Carpeta | Qué hay |
|---|---|
| `LostAndPrompt/` | App de macOS en SwiftUI (`project.yml` genera el proyecto de Xcode con XcodeGen) |
| `core/` | Núcleo en Rust: lectura de sesiones, búsqueda, organización y retención |
| `desktop/` | App de Windows y Linux en Tauri 2 (interfaz en React + TypeScript, backend en Rust) |
| `packaging/` | Recetas de Homebrew, winget y AUR |
| `docs/` | Diseño, requisitos, arquitectura, decisiones y hoja de ruta (en español) |
| `scripts/` | Versión, publicación, capturas y traducciones |

## Compilar y probar

```bash
# Núcleo (todas las plataformas)
cargo test -p lost-and-prompt-core

# App de Windows y Linux (también corre en macOS)
cd desktop && pnpm install && pnpm tauri dev

# App de macOS
brew install xcodegen && xcodegen generate && open LostAndPrompt.xcodeproj
```

Para probar la app de Mac con datos ficticios: `-LPMock YES` como argumento de arranque.

### Accesibilidad

- **Mac:** `xcodebuild test -project LostAndPrompt.xcodeproj -scheme LostAndPrompt` pasa la
  auditoría de accesibilidad de Xcode (VoiceOver, nombres, roles, acciones) por cinco vistas con los
  datos de ejemplo (`LostAndPromptUITests`). Los falsos positivos conocidos de SwiftUI están
  explicados en la propia prueba; cualquier otro aviso la hace fallar.
- **Windows y Linux:** se revisó con [axe-core](https://github.com/dequelabs/axe-core) en tema claro
  y oscuro, con los menús y diálogos abiertos. Al tocar la interfaz, mantén los grises con contraste
  de al menos 4,5:1, los `aria-label` de los botones que solo tienen icono y los roles de menú.

## Pautas

- **Mismo comportamiento en todas las plataformas.** Si cambias cómo se leen las sesiones, cambia
  `core/` y `LostAndPrompt/Core/ClaudeStore.swift`, y comprueba la paridad con
  `cargo run --release -p lost-and-prompt-core --example parity`.
- **Nunca escribir en los archivos de Claude Code**, salvo `settings.json` desde el ajuste de
  retención.
- **Textos de la interfaz en español e inglés.** Mac: `LostAndPrompt/Resources/Localizable.xcstrings`
  (`scripts/translate_en.py`). Windows y Linux: `desktop/src/i18n.ts`.
- **Estilo**: sigue el del código que tocas. Rust pasa `cargo clippy -- -D warnings`; TypeScript pasa
  `pnpm build`.
- **Commits** claros y en presente; una idea por pull request.
- Añade tu cambio a la sección `[Unreleased]` de `CHANGELOG.md`.

## Traducciones

¿Quieres Lost & Prompt en tu idioma? Abre un issue «Traducción a …» y te ayudamos a empezar.

## Publicar una versión (mantenedores)

```bash
scripts/bump-version.sh X.Y.Z      # y mover [Unreleased] a [X.Y.Z] en CHANGELOG.md
git commit -am "Lost & Prompt X.Y.Z" && git tag -a vX.Y.Z -m "Lost & Prompt X.Y.Z"
git push && git push origin vX.Y.Z
```

GitHub Actions compila las tres plataformas, firma las actualizaciones, crea la release y actualiza
Homebrew. Después: `komac update` para winget (ver `packaging/winget/README.md`).

## Código de conducta

Este proyecto sigue el [Código de conducta](CODE_OF_CONDUCT.md). Al participar, aceptas respetarlo.
