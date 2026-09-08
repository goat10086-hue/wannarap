import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  // Keep the last working assets available while a development rebuild runs.
  build: { outDir: "dist", emptyOutDir: !process.argv.includes("--watch") },
});
