import { defineConfig } from 'vitest/config';

// The base every package config merges into. Keeping it at the root means the reporters, the
// coverage provider and the test-file layout are decided once, and a package config only says
// what makes that package different.
export default defineConfig({
  test: {
    // An empty package must not redden `turbo run test`.
    passWithNoTests: true,
    // Vitest's 5s default is a render budget, not a correctness one, and it flakes on a two-core
    // CI runner. A test that takes 15s is a test worth looking at; one that takes 6s on a busy
    // machine is not a failure.
    testTimeout: 15_000,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      // Without this, a source file with no test at all is simply absent from the report and a
      // threshold cannot see it.
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
