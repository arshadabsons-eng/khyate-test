import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  // Without this, every route (admin console, tailor portal, public
  // storefront) statically imports into one bundle — an anonymous visitor to
  // a public listing page downloads/parses the whole admin+tailor app before
  // seeing the storefront. This splits each file-route's component (and its
  // heavy deps like recharts/react-table) into its own chunk, loaded only
  // when that route is actually visited.
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    tsConfigPaths(),
    tailwindcss(),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    host: true,
    strictPort: false,
  },
});
