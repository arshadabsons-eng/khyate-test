// Production build config — used on the server where TanStack router-plugin
// scanner can't run (the route tree is already generated and committed).
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths(), tailwindcss(), viteReact()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split big vendor groups into separate cacheable chunks so updates to
        // app code don't re-download React/charts/icons, and the initial parse
        // is spread across parallel requests.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@tabler/icons") || id.includes("lucide-react")) return "icons";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack")) return "tanstack";
          // React stays in the default vendor chunk to avoid circular chunks.
          return "vendor";
        },
      },
    },
  },
});
