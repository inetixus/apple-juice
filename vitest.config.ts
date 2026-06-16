import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "runtime/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next", "dist", "cli", "claude-code-main"],
  },
});
