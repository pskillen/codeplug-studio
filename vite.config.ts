/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const buildEnv = env.BUILD_ENV || process.env.BUILD_ENV || 'local';
  const buildVersion = (env.BUILD_VERSION || process.env.BUILD_VERSION || 'local').replace(
    /^v/,
    '',
  );

  return {
    base: '/',
    server: {
      proxy: {
        '/api/irts/repeaters': {
          target: 'https://www.irts.ie',
          changeOrigin: true,
          rewrite: () => '/dnloads/repeaters_Anytone578.csv',
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@core': path.resolve(__dirname, 'src/core'),
        '@integrations': path.resolve(__dirname, 'src/integrations'),
        '@app': path.resolve(__dirname, 'src/app'),
      },
    },
    define: {
      __BUILD_ENV__: JSON.stringify(buildEnv),
      __BUILD_VERSION__: JSON.stringify(buildVersion),
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      passWithNoTests: true,
      pool: 'threads',
      exclude: ['**/node_modules/**', 'e2e/**'],
      reporters: isGitHubActions
        ? ['default', ['junit', { outputFile: 'test-results/junit.xml', addFileAttribute: true }]]
        : ['default'],
    },
  };
});
