import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The AT-D890 hard deny lives in `connection.ts` (`atD890WriteMemory` / `atD890WriteBlockRaw`).
 * A new D890 `W` frame builder elsewhere would bypass it, so every production use of the frame
 * builder must be a deliberate, reviewed entry here.
 */
const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** Paths relative to `src/`, with forward slashes. */
const FRAME_BUILDER_DEFINITION_AND_REEXPORT = [
  'integrations/radio-io/kit/codecs/anytoneDmrRw.ts',
  'integrations/radio-io/kit/index.ts',
];

/**
 * Production files allowed to call the D890 write-frame builder. Add a single-purpose sender
 * here only with a review of why it may bypass the generic hard deny. The one-shot LocalInfo
 * range-change sender (#1369) validates its own single frame; see `rangeChangeBoundary.test.ts`.
 */
const ALLOWED_CALLERS = [
  'integrations/radio-io/radios/at-d890uv/connection.ts',
  'integrations/radio-io/radios/at-d890uv/rangeChange/rangeChangeSend.ts',
];

function listProductionSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listProductionSources(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('AT-D890 write-frame builder callers', () => {
  it('only allow-listed files build W frames', () => {
    const offenders = listProductionSources(srcRoot)
      .map((file) => relative(srcRoot, file).split(sep).join('/'))
      .filter((rel) => !FRAME_BUILDER_DEFINITION_AND_REEXPORT.includes(rel))
      .filter((rel) => !ALLOWED_CALLERS.includes(rel))
      .filter((rel) => {
        const text = readFileSync(join(srcRoot, rel), 'utf8');
        return /makeAnytoneDmrWriteFrame|anytoneDmrRwCodec/.test(text);
      });
    expect(offenders).toEqual([]);
  });

  it('every allow-listed caller still exists and uses the builder', () => {
    for (const rel of ALLOWED_CALLERS) {
      expect(readFileSync(join(srcRoot, rel), 'utf8')).toMatch(/makeAnytoneDmrWriteFrame\(/);
    }
  });
});
