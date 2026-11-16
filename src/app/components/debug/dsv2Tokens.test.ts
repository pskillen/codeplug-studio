import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { themeV2, dsv2CssVariablesResolver } from '@app/theme-v2.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(dir, '..', '..', '..');

function cssFiles(d: string): string[] {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(d, e.name)) : e.name.endsWith('.css') ? [join(d, e.name)] : [],
  );
}

// Every stylesheet under src/, not just the debug kit's.
const sheets: Record<string, string> = Object.fromEntries(
  cssFiles(srcRoot).map((f) => [relative(srcRoot, f), readFileSync(f, 'utf8')]),
);

const resolved = dsv2CssVariablesResolver(themeV2);
const defined = new Set([
  ...Object.keys(resolved.variables),
  ...Object.keys(resolved.light),
  ...Object.keys(resolved.dark),
]);

describe('stylesheets under src/', () => {
  it('only use --dsv2-* tokens the theme defines (an undefined token paints nothing)', () => {
    const bad: string[] = [];
    for (const [file, css] of Object.entries(sheets)) {
      // `var(--dsv2-x, fallback)` has its own fallback; only bare uses must resolve.
      for (const m of css.matchAll(/var\((--dsv2-[a-z0-9-]+)\s*\)/g)) {
        if (!defined.has(m[1]!)) bad.push(`${file}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('finds the stylesheets, so the check cannot pass on an empty glob', () => {
    expect(Object.keys(sheets).length).toBeGreaterThan(20);
  });
});
