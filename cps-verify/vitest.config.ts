import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      '@core': path.resolve(rootDir, '../src/core'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
    reporters: isGitHubActions
      ? [
          'default',
          [
            'junit',
            {
              outputFile: path.resolve(rootDir, '../test-results/cps-verify-junit.xml'),
              addFileAttribute: true,
            },
          ],
        ]
      : ['default'],
  },
});
