# 8. Plan de distribución

Objetivo: versiones distribuibles en macOS, Windows y Linux, con instalación sencilla,
actualizaciones automáticas y un proceso de publicación que salga de un solo comando.

Estado de partida (2026-10-31):

- **macOS**: app nativa 0.1.1 publicada (DMG + Homebrew). Sin actualizaciones automáticas.
- **Windows y Linux**: app Tauri funcionando; probada en Windows por el autor. CI compila
  `.exe` (NSIS), `.deb`, `.rpm` y AppImage, pero no se publica nada aún.
- Versiones repartidas en tres sitios (`project.yml`, `Cargo.toml`, `desktop/package.json`).

## Fase A · Experiencia igual en las tres plataformas (v0.2.0)

| # | Cambio | Plataformas | Detalle |
|---|---|---|---|
| A1 | **Elegir cualquier terminal** | Todas | Lista de terminales detectadas + opción **Personalizada** con una plantilla de comando (`{cwd}`, `{command}`). Ejemplos listos para las más conocidas. |
| A2 | **Warp en Windows y Linux** | Win, Linux | Detección por varias rutas de instalación, por `PATH` y por el registro del protocolo `warp://`; si no se detecta, se puede elegir igual. Verificar con Warp instalado en Windows. |
| A3 | **Más terminales en Windows** | Win | Windows Terminal, PowerShell 7 (`pwsh`), Windows PowerShell, Símbolo del sistema, Git Bash, WezTerm, Alacritty, Warp. |
| A4 | **Detectar terminales en Mac** | macOS | Mostrar solo las instaladas (hoy lista las cuatro siempre) y añadir WezTerm, Kitty, Alacritty y la personalizada. |
| A5 | **Botón de Ajustes** | Win, Linux | Engranaje fijo abajo en la barra lateral. Windows y Linux no tienen la barra de menús de Mac, así que hace falta un acceso visible. |
| A6 | **Acerca de y versión** | Todas | Ventana con ícono, versión, enlace al repositorio, licencia y «Buscar actualizaciones». En Win/Linux, en el menú del engranaje. |
| A7 | **Nombre en la barra de menús** | macOS | Hoy dice «LostAndPrompt»: fijar `CFBundleName` a «Lost & Prompt». |
| A8 | **Una sola instancia** | Win, Linux | Abrir la app dos veces enfoca la ventana existente (plugin `single-instance`). |
| A9 | **Recordar tamaño y posición** de la ventana | Win, Linux | Plugin `window-state`. |

## Fase B · Versiones (v0.2.0)

| # | Cambio | Detalle |
|---|---|---|
| B1 | **Una sola fuente de versión** | Archivo `VERSION` en la raíz. `scripts/bump-version.sh 0.2.0` lo propaga a `project.yml`, `Cargo.toml` y `package.json`. |
| B2 | **CHANGELOG.md** | Formato *Keep a Changelog*, en inglés y español. Las notas de cada release salen de aquí. |
| B3 | **Versionado semántico** | `MAYOR.MENOR.PARCHE`: parche para arreglos, menor para funciones nuevas. La 1.0.0, cuando las tres plataformas estén probadas y con actualizaciones automáticas. |
| B4 | **Etiquetas** | Cada versión es una etiqueta `vX.Y.Z` en `main`; la etiqueta dispara la publicación. |

## Fase C · Publicación automática (v0.2.0)

Un solo flujo `release.yml` que se dispara al subir la etiqueta `vX.Y.Z`:

1. Comprueba que la etiqueta coincide con `VERSION` y que hay entrada en el CHANGELOG.
2. Compila en paralelo:
   - **macOS** (runner de Mac): XcodeGen + DMG universal con firma ad hoc.
   - **Windows**: instalador NSIS `.exe`.
   - **Linux**: `.deb`, `.rpm` y AppImage (x64; arm64 más adelante).
3. Renombra todo con un esquema limpio, sin espacios ni `&`:
   `LostAndPrompt-0.2.0-macos-universal.dmg`, `LostAndPrompt-0.2.0-windows-x64-setup.exe`,
   `LostAndPrompt-0.2.0-linux-amd64.deb`, `…-linux-x86_64.rpm`, `…-linux-x86_64.AppImage`.
4. Firma los paquetes de actualización y genera los manifiestos (fase D).
5. Crea la release en GitHub con las notas del CHANGELOG y `SHA256SUMS.txt`.
6. Actualiza el cask de Homebrew y abre los cambios de winget (fase E).

Resultado: publicar una versión = `scripts/bump-version.sh 0.2.0` + `git push --tags`.

## Fase D · Actualizaciones automáticas (v0.3.0)

| Plataforma | Mecanismo | Cómo se ve |
|---|---|---|
| Windows y Linux (AppImage) | `tauri-plugin-updater`: la app consulta `latest.json` en la última release, descarga el paquete firmado y lo instala | Aviso discreto «Hay una nueva versión (0.3.0)» con las notas, **Actualizar y reiniciar** o **Más tarde**. Comprobación al abrir y cada 24 h; desactivable en Ajustes. |
| Linux (.deb / .rpm) | El gestor de paquetes del sistema | La app avisa de la versión nueva y enlaza la descarga (o el repositorio si lo hay). |
| macOS | **Sparkle 2** (estándar en apps de Mac fuera de la App Store; no necesita cuenta de Apple) con `appcast.xml` publicado en cada release | Mismo aviso, con el diálogo nativo de Sparkle. Homebrew sigue funcionando con `brew upgrade`. |

Seguridad: las actualizaciones van firmadas con claves propias (minisign para Tauri y EdDSA
para Sparkle). Las claves privadas viven solo en los secretos de GitHub y en una copia del
autor; **si se pierden, las apps instaladas ya no podrán actualizarse solas**.

## Fase E · Canales de distribución

| Canal | Plataforma | Prioridad | Notas |
|---|---|---|---|
| GitHub Releases | Todas | v0.2.0 | Base de todo lo demás |
| Homebrew (tap propio) | macOS | ✅ ya existe | El flujo actualiza versión y sha256 solo |
| **winget** | Windows | ⏳ enviado | `winget install axchisan.LostAndPrompt`. PR [microsoft/winget-pkgs#467137](https://github.com/microsoft/winget-pkgs/pull/467137) (2026-10-31), en revisión. Manifiestos en `packaging/winget/` |
| Scoop | Windows | ✅ | `scoop bucket add axchisan https://github.com/axchisan/scoop-bucket` + `scoop install axchisan/lost-and-prompt`; el bucket se actualiza solo (Excavator) |
| **AUR** (`lost-and-prompt-bin`) | Arch y derivados | ⏳ listo para publicar | `packaging/aur/`; CI lo construye e instala en Arch. Falta la cuenta de AUR del autor |
| **Flathub** | Linux (todas) | v0.4.0 | Revisión humana; sandbox con acceso de lectura a `~/.claude` |
| Microsoft Store | Windows | Más adelante | Gratis para desarrolladores individuales; firma la app la propia tienda |

## Fase F · Paridad con la versión de Mac (v0.3.0)

| # | Función | Detalle |
|---|---|---|
| F1 | Ícono en la bandeja del sistema | Equivalente al de la barra de menús de Mac: sesiones recientes y búsqueda |
| F2 | Atajo global | `Ctrl+Alt+K` por defecto (en Windows `Alt+Espacio` es el menú de ventana y PowerToys lo usa), configurable |
| F3 | Abrir al iniciar sesión | Plugin `autostart` |
| F4 | **Sesiones de WSL** (Windows) | Leer `\\wsl$\<distro>\home\<usuario>\.claude\projects` y reanudar con `wsl.exe -d <distro> --cd <ruta> claude --resume …` |
| F5 | «Elegir carpeta…» | Reanudar una sesión cuya carpeta ya no existe, como en Mac |
| F6 | Registro de errores | Archivo de log rotativo para adjuntar en reportes de fallos |

## Fase G · Repositorio y comunidad (en paralelo)

- `CONTRIBUTING.md` (cómo compilar cada app y cómo publicar), plantillas de issues (fallo con
  sistema y versión, propuesta de función) y de pull requests, `SECURITY.md`.
- Dependabot para Cargo, npm y GitHub Actions.
- README con secciones de instalación para las tres plataformas y capturas de Windows y Linux
  (las de Windows las saca el autor con Claude Code en su PC).
- `docs/QA.md`: lista de comprobación manual por plataforma antes de cada release.

## Orden propuesto

| Versión | Contenido |
|---|---|
| **0.2.0** | Fases A, B, C y winget: terminales elegibles con Warp en todas partes, botón de Ajustes, Acerca de, versión única, publicación automática de las tres plataformas |
| **0.3.0** | Fases D y F: actualizaciones automáticas, bandeja, atajo global, WSL; Scoop y AUR |
| **0.4.0** | Flathub, capturas y documentación final |
| **1.0.0** | Las tres plataformas probadas y actualizándose solas |

## Lo que necesita el autor

1. **Probar en Windows** (con Claude Code en ese PC): terminales detectadas, Warp, reanudar,
   y capturas para el README.
2. **Guardar las claves de actualización** cuando se generen (fase D): en un gestor de
   contraseñas, además de los secretos de GitHub.
3. **Clave de despliegue de Homebrew**: ejecutar una vez `scripts/setup-tap-key.sh` (clave SSH con
   escritura solo en `homebrew-tap`, guardada como secreto `HOMEBREW_TAP_DEPLOY_KEY`). Para winget,
   una cuenta de GitHub enlazada para los PR.
