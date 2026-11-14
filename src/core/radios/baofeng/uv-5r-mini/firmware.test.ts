import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { UV5RMINI_UNOFFICIAL_STOCK_COPIES } from './firmware.ts';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '../../../..');
const OWN_FILE = ['core', 'radios', 'baofeng', 'uv-5r-mini', 'firmware.ts'].join('/');

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSources(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('UV5RMINI_UNOFFICIAL_STOCK_COPIES', () => {
  const sources = listSources(srcRoot).map((full) => ({
    rel: relative(srcRoot, full).split(sep).join('/'),
    text: readFileSync(full, 'utf8'),
  }));

  it('is the only place in the source tree that holds the links', () => {
    expect(UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies.length).toBeGreaterThan(0);
    for (const { url } of UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies) {
      // The key part of each link, so that a copy with a different prefix is caught too.
      const key = url.slice(url.lastIndexOf('/') + 1);
      const holders = sources.filter((s) => s.text.includes(key)).map((s) => s.rel);
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

  it('links over https, each to one stock file', () => {
    for (const c of UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies) {
      expect(new URL(c.url).protocol).toBe('https:');
      expect(new URL(c.url).hostname).toBe(UV5RMINI_UNOFFICIAL_STOCK_COPIES.host);
      expect(c.fileName).toMatch(/^stock-.*\.ufw$/);
    }
  });
});
