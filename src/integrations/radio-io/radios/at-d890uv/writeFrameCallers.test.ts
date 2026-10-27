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

/** A function that builds frames but skips the latch carries this marker, with the reason, in its body. */
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
    }
    // The generic connection is the one R sender: the range-change sender sends only its one W (its R frames
    // go through connection.ts), so the R builder is required of connection.ts alone.
    expect(
      readFileSync(join(srcRoot, 'integrations/radio-io/radios/at-d890uv/connection.ts'), 'utf8'),
    ).toMatch(/makeAnytoneDmrReadFrame\(/);
  });

  it('every frame built in an allow-listed caller sits in a function that calls the latch (or says why not)', () => {
    // A top-level function runs from its declaration line to the next one at column 0.
    const topLevel = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm;
    const required = [
      { build: 'makeAnytoneDmrWriteFrame(', latch: 'noteAtD890WriteFrame(' },
      { build: 'makeAnytoneDmrReadFrame(', latch: 'assertAtD890ReadAllowed(' },
    ];
    for (const rel of ALLOWED_CALLERS) {
      const text = readFileSync(join(srcRoot, rel), 'utf8');
      const starts = [...text.matchAll(topLevel)].map((m) => ({ name: m[1]!, at: m.index! }));
      for (const { build, latch } of required) {
        let from = text.indexOf(build);
        let found = 0;
        while (from !== -1) {
          found += 1;
          const idx = from;
          const fnIdx = starts.filter((s) => s.at <= idx).length - 1;
          expect(fnIdx, `${rel}: ${build} outside any top-level function`).toBeGreaterThanOrEqual(
            0,
          );
          const start = starts[fnIdx]!;
          const body = text.slice(start.at, starts[fnIdx + 1]?.at ?? text.length);
          if (!LATCH_EXEMPT.test(body)) {
            expect(body, `${rel}: ${start.name}() builds a frame without ${latch}`).toContain(
              latch,
            );
          }
          from = text.indexOf(build, idx + build.length);
        }
        // Only the generic connection sends R frames (the range-change sender's R frames go through it), so
        // an R-free sender is fine; every sender must still call the W builder (checked above).
        if (build.startsWith('makeAnytoneDmrWriteFrame')) {
          expect(found, `${rel} no longer calls ${build}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
