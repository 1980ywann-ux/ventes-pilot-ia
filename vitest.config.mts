import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/db/preparer-base.ts"],
    // Les tests partagent une base : on les exécute l'un après l'autre.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
