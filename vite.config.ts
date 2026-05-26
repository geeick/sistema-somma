import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// Removed lovable-tagger import — project no longer uses Lovable

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
