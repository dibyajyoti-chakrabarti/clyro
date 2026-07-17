import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // monaco-editor/monaco-yaml ship their own internal worker/RPC plumbing that
  // esbuild's dep pre-bundling can rewrite inconsistently between the main
  // thread and the worker entry point (yaml.worker.js), producing two mismatched
  // module instances and "Missing requestHandler" errors at runtime. Excluding
  // them from pre-bundling keeps both sides using the same untouched module.
  optimizeDeps: {
    exclude: ["monaco-editor", "monaco-yaml"],
  },
});
