/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { REPEATERBOOK_USER_AGENT } from './src/integrations/repeaters/repeaterbook/constants';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

function rewriteRepeaterBookExportProxyPath(proxyPath: string): string {
  const queryStart = proxyPath.indexOf('?');
  const query = queryStart >= 0 ? proxyPath.slice(queryStart + 1) : '';
  const params = new URLSearchParams(query);
  const region = params.get('region');
  params.delete('region');
  const upstreamPath = region === 'row' ? '/api/exportROW.php' : '/api/export.php';
  const rest = params.toString();
  return rest ? `${upstreamPath}?${rest}` : upstreamPath;
}

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
        '/api/repeaterbook/export': {
          target: 'https://www.repeaterbook.com',
          changeOrigin: true,
          rewrite: rewriteRepeaterBookExportProxyPath,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.setHeader('User-Agent', REPEATERBOOK_USER_AGENT);
              const token = req.headers['x-rb-app-token'];
              if (typeof token === 'string' && token.trim()) {
                proxyReq.setHeader('X-RB-App-Token', token);
              }
            });
          },
        },
        '/api/radioid': {
          target: 'https://database.radioid.net',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/radioid/, '/api'),
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
