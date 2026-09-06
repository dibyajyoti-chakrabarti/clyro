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
  build: {
    rollupOptions: {
      output: {
        // Everything used to land in one 5.9 MB entry chunk, so a visitor to the
        // landing page downloaded the CloudFormation editor and the animation
        // libraries before anything rendered. Monaco is code-split at its import
        // site instead (see step5/IacEditor.jsx); these are the remaining vendors
        // big enough to be worth caching separately from application code, which
        // changes far more often than they do.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          amplify: ["aws-amplify"],
          motion: ["gsap", "@gsap/react", "lenis", "lottie-react"],
          markdown: ["react-markdown"],
        },
      },
    },
  },
});
