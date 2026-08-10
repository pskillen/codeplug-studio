/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { REPEATERBOOK_USER_AGENT } from './src/integrations/repeaters/repeaterbook/constants';
import { NOMINATIM_USER_AGENT } from './src/integrations/geocoding/nominatimConstants';

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

// Mirrors buildNominatimSearchUpstreamUrl in functions/lib/nominatimUpstream.ts — without a
// pinned `format`, Nominatim serves its interactive HTML search UI (redirecting to
// /ui/search.html) instead of JSON, which then fails as a cross-origin navigation.
function rewriteNominatimSearchProxyPath(proxyPath: string): string {
  const queryStart = proxyPath.indexOf('?');
  const query = queryStart >= 0 ? proxyPath.slice(queryStart + 1) : '';
  const params = new URLSearchParams(query);
  params.set('format', 'jsonv2');
  return `/search?${params.toString()}`;
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
    // Top-level await (used transitively by satellite.js's optional WASM build inside
    // the pass-prediction worker, see #863) needs a baseline newer than Vite's default
    // target. The app already requires Web Serial (Chromium-only, recent versions) for
    // radio writes, so this is not a meaningful new constraint.
    build: {
      target: 'es2022',
    },
    server: {
      // Allow ngrok public hostnames when tunneling local Vite (Run Dev Server).
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
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
        '/api/celestrak/amateur': {
          target: 'https://celestrak.org',
          changeOrigin: true,
          rewrite: () => '/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle',
        },
        '/api/amsat/nasabare': {
          target: 'https://www.amsat.org',
          changeOrigin: true,
          rewrite: () => '/tle/current/nasabare.txt',
        },
        '/api/satnogs/transmitters': {
          target: 'https://db.satnogs.org',
          changeOrigin: true,
          rewrite: (proxyPath) =>
            proxyPath.replace(/^\/api\/satnogs\/transmitters/, '/api/transmitters/'),
        },
        '/api/nominatim/search': {
          target: 'https://nominatim.openstreetmap.org',
          changeOrigin: true,
          rewrite: rewriteNominatimSearchProxyPath,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('User-Agent', NOMINATIM_USER_AGENT);
            });
          },
        },
      },
    },
    worker: {
      // Default 'iife' worker output can't support the top-level await pulled in
      // transitively by satellite.js's optional WASM build (see #863).
      format: 'es',
    },
    optimizeDeps: {
      // esbuild's dep pre-bundler hangs on satellite.js's lazily-imported WASM
      // submodules (Node-only `#wasm-*` subpath imports, never actually called by
      // this app). It's pure ESM already, so serve it directly instead (see #863).
      exclude: ['satellite.js'],
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
      exclude: ['**/node_modules/**', 'e2e/**', 'cps-verify/**', '.claude/**'],
      reporters: isGitHubActions
        ? ['default', ['junit', { outputFile: 'test-results/junit.xml', addFileAttribute: true }]]
        : ['default'],
    },
  };
});
