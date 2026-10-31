# Seguridad

## Versiones con soporte

Solo la [última versión](https://github.com/axchisan/lost-and-prompt/releases/latest) recibe
arreglos de seguridad. Lost & Prompt se actualiza sola en las tres plataformas.

## Reportar una vulnerabilidad

**No abras un issue público.** Usa el [reporte privado de vulnerabilidades de GitHub](https://github.com/axchisan/lost-and-prompt/security/advisories/new).
Incluye los pasos para reproducirla y la versión afectada. Recibirás respuesta en pocos días.

## Lo que hace la app con tus datos

- Lee las sesiones de Claude Code sin modificarlas y no las envía a ningún servidor.
- Solo se conecta a GitHub para comprobar y descargar actualizaciones.
- Las actualizaciones van firmadas (Sparkle con EdDSA en macOS; minisign en Windows y Linux) y la app
  rechaza las que no tengan una firma válida.

---

**Reporting a vulnerability:** please don't open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/axchisan/lost-and-prompt/security/advisories/new).
