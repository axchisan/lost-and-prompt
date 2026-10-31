# Pruebas antes de cada versión

Lista de comprobación manual por plataforma. Una versión se publica cuando su plataforma pasa
todo lo marcado como **obligatorio**.

## Windows

Instalador: artefacto `lost-and-prompt-windows` de la última ejecución verde de
[«App de escritorio (Linux y Windows)»](https://github.com/axchisan/lost-and-prompt/actions/workflows/desktop.yml)
o el `.exe` de la release. Windows SmartScreen avisará porque no está firmado: *Más información →
Ejecutar de todas formas*.

### Obligatorio

- [ ] Se instala sin permisos de administrador y aparece en el menú Inicio como «Lost & Prompt».
- [ ] Al abrir, aparecen las sesiones de `%USERPROFILE%\.claude\projects` agrupadas por día.
- [ ] La bienvenida aparece solo la primera vez.
- [ ] El ícono de la caja se ve en la barra de tareas y en la ventana.
- [ ] **Reanudar** con Windows Terminal abre una pestaña en la carpeta de la sesión y arranca
      `claude --resume`.
- [ ] Ajustes → General lista las terminales; las no detectadas dicen «(no detectada)».
- [ ] **Warp**: si está instalado, aparece como detectado y reanudar abre una pestaña de Warp en
      la carpeta correcta. Si no aparece, anotar dónde está instalado (`where warp`,
      `Get-Command warp`, y si existe `HKCU\Software\Classes\warp`).
- [ ] Terminal **personalizada**: con `wt -d {cwd} pwsh -NoExit -Command {command}` reanuda bien.
- [ ] Ctrl+K busca en las conversaciones y ↩ reanuda.
- [ ] El engranaje (abajo a la izquierda) abre Ajustes, Acerca de (con la versión correcta),
      Buscar actualizaciones e Informar de un problema.
- [ ] Abrir la app por segunda vez enfoca la ventana existente en vez de abrir otra.
- [ ] Cerrar y volver a abrir conserva tamaño y posición de la ventana, favoritos y colecciones.

### Deseable

- [ ] Tema claro, oscuro y sistema; idioma español e inglés.
- [ ] Vista de tarjetas con el detalle a la derecha; botones compactos si el panel es estrecho.
- [ ] Barras de desplazamiento finas, sin flechas.
- [ ] Actividad muestra costos y carpetas.
- [ ] Una sesión nueva de Claude Code aparece sola en la lista a los pocos segundos.

### Capturas para el README

Guardar en `docs/screenshots/windows/` (PNG, ventana a ~1440×900, tema claro y oscuro):
`recents-light.png`, `recents-dark.png`, `cards-light.png`, `quickopen-light.png`,
`settings-general.png`. Usar sesiones sin datos personales o una carpeta `~/.claude` de prueba.

## Linux

Igual que Windows, con el `.deb`, `.rpm` o AppImage, y comprobando las terminales del escritorio
(GNOME Terminal, Ptyxis, Konsole, Kitty, Warp…).

## macOS

- [ ] `brew upgrade --cask lost-and-prompt` instala la versión nueva.
- [ ] Ajustes → General solo lista terminales instaladas y la personalizada funciona.
- [ ] La barra de menús dice «Lost & Prompt».
- [ ] Reanudar en Warp, búsqueda, colecciones y retención siguen funcionando.
