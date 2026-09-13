import { defineConfig } from "vitest/config";

/**
 * Minimal node-environment config. packages/web's `test` script (`vitest run`) had zero
 * test files and no config before this — see the project queue's own flagged gap. This
 * package doesn't need a DOM/browser environment for its one real test target so far
 * (the ecosystem registry is pure filesystem + validation logic); add `environment:
 * "jsdom"` and the jsdom dependency if a future test needs to render a component.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
