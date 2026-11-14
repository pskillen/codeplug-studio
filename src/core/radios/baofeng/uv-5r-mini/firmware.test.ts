import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { UV5RMINI_STOCK_FIRMWARE, UV5RMINI_UNOFFICIAL_STOCK_COPIES } from './firmware.ts';
import {
  isUv5rMiniHardwareProven,
  UV5RMINI_PROVEN_HARDWARE,
  UV5RMINI_STOCK_BASE_KEYS,
  uv5rMiniStockBase,
} from './stockBases.ts';

describe('UV5RMINI_STOCK_FIRMWARE.supportedRadios (#1670)', () => {
  const text = UV5RMINI_STOCK_FIRMWARE.supportedRadios!;
  const isSupported = ([suffix, firmware]: readonly [string, string]) =>
    uv5rMiniStockBase(suffix, firmware)?.base === UV5RMINI_STOCK_FIRMWARE.baseName;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  it("names the descriptor's stock base, as the stock-base table spells it", () => {
    const supported = UV5RMINI_STOCK_BASE_KEYS.filter(isSupported);
    expect(supported).toHaveLength(1);
    const [suffix, firmware] = supported[0]!;
    expect(text).toContain(`Firmware ${firmware}`);
    expect(text).toMatch(new RegExp(`5RMINI ${escape(suffix)}\\b`));
  });

  it('names no other base, and only Firmware lines the table has', () => {
    for (const [suffix, firmware] of UV5RMINI_STOCK_BASE_KEYS.filter((k) => !isSupported(k))) {
      expect(text).not.toContain(`Firmware ${firmware}`);
      expect(text).not.toMatch(new RegExp(`5RMINI ${escape(suffix)}\\b`));
    }
    const named = [...text.matchAll(/Firmware (V\d+\.\d+)/g)].map((m) => m[1]!);
    expect(named.length).toBeGreaterThan(0);
    for (const f of named) expect(UV5RMINI_STOCK_BASE_KEYS.some(([, kf]) => kf === f)).toBe(true);
  });

  it('names every proven Hardware line, and no other', () => {
    for (const hw of UV5RMINI_PROVEN_HARDWARE) expect(text).toContain(`Hardware ${hw}`);
    const named = [...text.matchAll(/Hardware (V\d+\.\d+)/g)].map((m) => m[1]!);
    expect(named.length).toBeGreaterThan(0);
    for (const hw of named) expect(isUv5rMiniHardwareProven(hw)).toBe(true);
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '../../../..');
const repoRoot = join(srcRoot, '..');
const OWN_FILE = ['src', 'core', 'radios', 'baofeng', 'uv-5r-mini', 'firmware.ts'].join('/');
const STOCK_STEP = join(srcRoot, 'app', 'routes', 'firmware', 'steps', 'StockStep.tsx');

/** Generated, vendored or gitignored trees: not ours to scan. */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'android',
  'tmp',
  'coverage',
  'test-results',
  'local',
  'fixtures',
]);

function listFiles(dir: string, accept: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...listFiles(full, accept));
    } else if (accept(entry.name)) out.push(full);
  }
  return out;
}

function read(full: string) {
  return { rel: relative(repoRoot, full).split(sep).join('/'), text: readFileSync(full, 'utf8') };
}

describe('UV5RMINI_UNOFFICIAL_STOCK_COPIES', () => {
  const sources = listFiles(srcRoot, (name) => /\.tsx?$/.test(name)).map(read);
  // Every file in the repo, docs, public assets and JSON included.
  const everything = listFiles(repoRoot, () => true).map(read);

  it('is the only place in the repo that holds the links', () => {
    expect(UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies.length).toBeGreaterThan(0);
    for (const { url } of UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies) {
      // The key part of each link, so that a copy with a different prefix is caught too.
      const key = url.slice(url.lastIndexOf('/') + 1);
      const holders = everything.filter((s) => s.text.includes(key)).map((s) => s.rel);
      expect(holders).toEqual([OWN_FILE]);
    }
  });

  it('is never fetched: no source names the host next to a network call', () => {
    const host = UV5RMINI_UNOFFICIAL_STOCK_COPIES.host;
    const fetching = /\bfetch\(|XMLHttpRequest|\baxios\b/;
    const both = sources
      .filter((s) => !/\.test\.tsx?$/.test(s.rel))
      .filter(
        (s) =>
          (s.text.includes(host) || s.text.includes('UNOFFICIAL_STOCK_COPIES')) &&
          fetching.test(s.text),
      )
      .map((s) => s.rel);
    expect(both).toEqual([]);
  });

  it('is never fetched by the Stock firmware step, which reads each link generically', () => {
    const text = readFileSync(STOCK_STEP, 'utf8');
    expect(text).not.toMatch(/\bfetch\(|XMLHttpRequest/);
  });

  it('links over https, each to one stock file', () => {
    for (const c of UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies) {
      expect(new URL(c.url).protocol).toBe('https:');
      expect(new URL(c.url).hostname).toBe(UV5RMINI_UNOFFICIAL_STOCK_COPIES.host);
      expect(c.fileName).toMatch(/^stock-.*\.ufw$/);
    }
  });
});
