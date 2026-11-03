import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Do not run copies of tests that the update commands keep as backups.
    exclude: ["**/node_modules/**", "**/.git/**", "**/.update-backup/**"],
  },
});
