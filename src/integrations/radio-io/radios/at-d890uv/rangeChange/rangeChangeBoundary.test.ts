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
    // writeFrameCallers.test.ts names the sender in its own allow-list (#1410's scan).
    const allowed = (rel: string) =>
      rel.startsWith(RANGE_CHANGE_DIR + sep) || rel === join(D890_DIR, 'writeFrameCallers.test.ts');
    expect(offenders(/rangeChangeSend/, allowed)).toEqual([]);
  });

  it('only rangeChange/ files reference AT_D890_RANGE_CHANGE_EXTENT', () => {
    expect(
      offenders(/AT_D890_RANGE_CHANGE_EXTENT/, (rel) => rel.startsWith(RANGE_CHANGE_DIR + sep)),
    ).toEqual([]);
  });

  // The frame builder is exported from kit/, so a file anywhere in src could build a LocalInfo frame. Scan all of
  // src. The allow-list is the definition, its re-export, its own test, the generic D890 connection and the
  // one-shot range sender (plus this test, which names it).
  const KIT_CODEC = join('integrations', 'radio-io', 'kit', 'codecs', 'anytoneDmrRw.ts');
  const KIT_CODEC_TEST = join('integrations', 'radio-io', 'kit', 'codecs', 'anytoneDmrRw.test.ts');
  const KIT_INDEX = join('integrations', 'radio-io', 'kit', 'index.ts');
  const FRAME_BUILDER_ALLOWED = new Set([
    KIT_CODEC,
    KIT_CODEC_TEST,
    KIT_INDEX,
    join(D890_DIR, 'connection.ts'),
    join(D890_DIR, 'rangeChange', 'rangeChangeSend.ts'),
    join(D890_DIR, 'rangeChange', 'rangeChangeBoundary.test.ts'),
    join(D890_DIR, 'writeFrameCallers.test.ts'),
  ]);

  it('across all of src, only the allow-list references makeAnytoneDmrWriteFrame', () => {
    expect(offenders(/makeAnytoneDmrWriteFrame/, (rel) => FRAME_BUILDER_ALLOWED.has(rel))).toEqual(
      [],
    );
  });

  it('across all of src, only the codec, its re-export and tests reference anytoneDmrRwCodec', () => {
    const allowed = new Set([
      KIT_CODEC,
      KIT_CODEC_TEST,
      KIT_INDEX,
      join(D890_DIR, 'rangeChange', 'rangeChangeBoundary.test.ts'),
      join(D890_DIR, 'writeFrameCallers.test.ts'),
    ]);
    expect(offenders(/anytoneDmrRwCodec/, (rel) => allowed.has(rel))).toEqual([]);
  });

  it('within radios/at-d890uv/, only connection.ts and rangeChangeSend.ts call pipe.write', () => {
    const allowed = new Set([
      join(D890_DIR, 'connection.ts'),
      join(D890_DIR, 'rangeChange', 'rangeChangeSend.ts'),
    ]);
    const bad = files
      .filter(
        (f) =>
          f.rel.startsWith(D890_DIR + sep) &&
          !/\.test\.tsx?$/.test(f.rel) &&
          !f.rel.includes(`${sep}__fixtures__${sep}`) &&
          /\.write\(/.test(f.text),
      )
      .map((f) => f.rel)
      .filter((rel) => !allowed.has(rel));
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
