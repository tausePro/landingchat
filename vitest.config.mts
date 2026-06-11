import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/app/api/**"],
      exclude: [
        "**/*.{test,spec}.{js,ts,tsx}",
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/coverage/**"
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
