import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "next/headers": fileURLToPath(
        new URL("../web/node_modules/next/headers.js", import.meta.url),
      ),
      "@": fileURLToPath(new URL("../web/src", import.meta.url)),
    },
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "../web/src/lib/offline/store.test.ts",
      "../web/src/test/service-worker.test.ts",
    ],
    testTimeout: 60000,
  },
});
