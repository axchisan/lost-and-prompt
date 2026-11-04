import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri espera un puerto fijo y no debe tapar los errores de Rust en la terminal.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // La guía (docs/guia/guia.json) y el CHANGELOG viven fuera de desktop/: se importan en el build.
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] }, fs: { allow: [".."] } },
  build: { target: "es2022" },
});
