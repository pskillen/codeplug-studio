/**
 * Import boundary for the LocalInfo sender. A test, not an ESLint block: flat-config blocks replace
 * `no-restricted-imports` options rather than merge them, so a new block would silently drop the layer rules.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const RANGE_CHANGE_DIR = ['integrations', 'radio-io', 'radios', 'at-d890uv', 'rangeChange'].join(
  sep,
);
const D890_DIR = ['integrations', 'radio-io', 'radios', 'at-d890uv'].join(sep);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((p) => ({
  rel: relative(SRC, p),
  text: readFileSync(p, 'utf8'),
}));

/** Files that mention `needle` anywhere (import, re-export or use), outside the allowed set. */
function offenders(needle: RegExp, allowed: (rel: string) => boolean): string[] {
  return files.filter((f) => needle.test(f.text) && !allowed(f.rel)).map((f) => f.rel);
}

describe('range-change send boundary', () => {
  it('scans a plausible number of source files', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('only rangeChange/ files reference rangeChangeSend', () => {
    expect(offenders(/rangeChangeSend/, (rel) => rel.startsWith(RANGE_CHANGE_DIR + sep))).toEqual(
      [],
    );
  });

  it('only rangeChange/ files reference AT_D890_RANGE_CHANGE_EXTENT', () => {
    expect(
      offenders(/AT_D890_RANGE_CHANGE_EXTENT/, (rel) => rel.startsWith(RANGE_CHANGE_DIR + sep)),
    ).toEqual([]);
  });

  it('within radios/at-d890uv/, only connection.ts and rangeChangeSend.ts reference makeAnytoneDmrWriteFrame', () => {
    const allowed = new Set([
      join(D890_DIR, 'connection.ts'),
      join(D890_DIR, 'rangeChange', 'rangeChangeSend.ts'),
    ]);
    const bad = files
      .filter((f) => f.rel.startsWith(D890_DIR + sep) && /makeAnytoneDmrWriteFrame/.test(f.text))
      .map((f) => f.rel)
      .filter(
        (rel) =>
          !allowed.has(rel) && rel !== join(D890_DIR, 'rangeChange', 'rangeChangeBoundary.test.ts'),
      );
    expect(bad).toEqual([]);
  });

  it('the rangeChange barrel does not export the sender or the extent', () => {
    const barrel = files.find((f) => f.rel === join(RANGE_CHANGE_DIR, 'index.ts'))!;
    // Strip comments: the header explains what is not exported.
    const code = barrel.text.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(
      /rangeChangeSend|AT_D890_RANGE_CHANGE_EXTENT|createAtD890RangeChangeSender/,
    );
  });
});
