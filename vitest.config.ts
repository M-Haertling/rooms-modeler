import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    forks: {
      execArgv: ["--experimental-sqlite"],
    },
  },
});
