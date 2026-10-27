import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The AT-D890 hard deny lives in `connection.ts` (`atD890WriteMemory`), and the program-session
 * latch (no `R` after the first `W`, pending-units backstop; `programSession.ts`) sits beside it.
 * A new D890 `R` or `W` frame builder elsewhere would bypass both, so every production use of
 * either frame builder must be a deliberate, reviewed entry here, and must opt in to the latch.
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

const FRAME_BUILDERS = /makeAnytoneDmrWriteFrame|makeAnytoneDmrReadFrame|anytoneDmrRwCodec/;

/** A sender that skips the latch carries this marker, with the reason, instead. */
const LATCH_EXEMPT = /\/\/ latch-exempt: \S/;

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
        return FRAME_BUILDERS.test(text);
      });
    expect(offenders).toEqual([]);
  });

  it('every allow-listed caller still exists and uses the builders', () => {
    for (const rel of ALLOWED_CALLERS) {
      const text = readFileSync(join(srcRoot, rel), 'utf8');
      expect(text).toMatch(/makeAnytoneDmrWriteFrame\(/);
      expect(text).toMatch(/makeAnytoneDmrReadFrame\(/);
    }
  });

  it('every allow-listed caller uses the program-session latch (or says why not)', () => {
    for (const rel of ALLOWED_CALLERS) {
      const text = readFileSync(join(srcRoot, rel), 'utf8');
      if (LATCH_EXEMPT.test(text)) continue;
      expect(text, `${rel} sends W frames without noteAtD890WriteFrame`).toMatch(
        /noteAtD890WriteFrame\(/,
      );
      expect(text, `${rel} sends R frames without assertAtD890ReadAllowed`).toMatch(
        /assertAtD890ReadAllowed\(/,
      );
    }
  });
});
