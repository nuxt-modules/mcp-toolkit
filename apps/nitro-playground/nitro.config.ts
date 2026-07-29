import { fileURLToPath } from "node:url";
import { defineConfig } from "nitro";

const toolkit = new URL("../../packages/nitro-mcp-toolkit/src/", import.meta.url);

export default defineConfig({
  compatibilityDate: "2026-07-01",
  // Nitro only scans for file-based routes once a `serverDir` is set.
  serverDir: "server",
  // Resolve the toolkit to its source so editing `packages/nitro-mcp-toolkit`
  // hot-reloads here without a rebuild.
  alias: {
    "nitro-mcp-toolkit": fileURLToPath(new URL("runtime/index.ts", toolkit)),
  },
});
