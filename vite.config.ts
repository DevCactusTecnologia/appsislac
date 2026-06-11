import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react", "react-dom",
      "@tiptap/core", "@tiptap/pm", "@tiptap/react", "@tiptap/starter-kit",
      "@tiptap/extension-paragraph",
      "@tiptap/extension-table", "@tiptap/extension-table-row",
      "@tiptap/extension-table-cell", "@tiptap/extension-table-header",
      "@tiptap/extension-text-style", "@tiptap/extension-color",
      "@tiptap/extension-highlight", "@tiptap/extension-text-align",
      "@tiptap/extension-underline", "@tiptap/extension-font-family",
    ],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
}));
