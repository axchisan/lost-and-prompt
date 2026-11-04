# Vídeo promocional

Hecho con [Remotion](https://www.remotion.dev) (vídeo escrito en React). Vive fuera de las apps: sus
dependencias no entran en ningún build. Licencia: la gratuita de Remotion, válida para personas y
equipos de hasta 3 personas, también con uso comercial.

```sh
cd promo
npm install
npm run studio                    # vista previa en el navegador, con línea de tiempo
npm run render                    # las cuatro versiones en out/
npm run render -- promo-es-9x16   # solo una
```

- **Versiones:** `promo-{es,en}-16x9` (1920×1080: YouTube, LinkedIn, X) y `promo-{es,en}-9x16`
  (1080×1920: Reels, TikTok, Shorts). 35 s a 30 fps.
- **Guion:** pregunta («¿Dónde quedó esa sesión…?») → marca → seis funciones con su captura →
  llamada a la acción (web y `brew install`). Los textos van quemados en la imagen, porque muchas
  redes reproducen sin sonido.
- **Textos:** `src/copy.ts` (español e inglés). Montaje y tiempos: `src/Promo.tsx`.
- **Imágenes:** `npm run assets` copia `docs/screenshots` y el icono a `public/` (no se guarda en
  git). Son las capturas con datos de ejemplo (`-LPMock YES`), nunca sesiones reales.
