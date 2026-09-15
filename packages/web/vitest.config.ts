import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Minimal node-environment config. packages/web's `test` script (`vitest run`) had zero
 * test files and no config before this — see the project queue's own flagged gap. This
 * package doesn't need a DOM/browser environment for its one real test target so far
 * (the ecosystem registry is pure filesystem + validation logic); add `environment:
 * "jsdom"` and the jsdom dependency if a future test needs to render a component.
 */
export default defineConfig({
  /**
   * `@/` must resolve here the same way it does in `next build` and tsconfig `paths`.
   * Without it, a route under test only resolved the `@/` specifiers some test happened
   * to `vi.mock`, so importing a NEW shared module made fifteen unrelated tests fail with
   * a module-not-found. Tests should fail because behavior changed, not because the
   * resolver disagrees with the bundler.
   */
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
