import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '../../..');
const allowed = new Set(['app/lib/publicServiceCountries.ts']);

const DATA_IMPORT = /(?:from|import)\s*\(?\s*['"][^'"]*publicServices\/data\//;

function walk(dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, files);
      continue;
    }
    if (!/\.(ts|tsx|mjs)$/.test(name)) continue;
    if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
    files.push(path);
  }
}

describe('public-service import isolation', () => {
  it('does not re-export country datasets from the core barrel', () => {
    const barrel = readFileSync(join(here, 'index.ts'), 'utf8');
    expect(barrel).not.toMatch(/data\//);
    expect(barrel).not.toMatch(/gb\.ts|ie\.ts|summaries\.ts/);
  });

  it('allows country data imports only from the app registry', () => {
    const files: string[] = [];
    walk(srcRoot, files);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(srcRoot, file).replaceAll('\\', '/');
      if (rel.startsWith('core/domain/publicServices/data/')) continue;
      if (allowed.has(rel)) continue;
      const text = readFileSync(file, 'utf8');
      if (DATA_IMPORT.test(text)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
