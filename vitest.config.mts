import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/db/preparer-base.ts"],
    // Les tests partagent une base : on les exécute l'un après l'autre.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
  },
});
