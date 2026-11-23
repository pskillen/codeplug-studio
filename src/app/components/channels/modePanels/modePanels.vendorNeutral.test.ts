import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const BANNED = /Anytone|DM-?32|OpenGD77|RadioFoundry|\bCPS\b/i;
const dir = dirname(fileURLToPath(import.meta.url));

describe('modePanels vendor-neutral copy', () => {
  it('has no radio or format names in panel source', () => {
    const offenders: string[] = [];
    for (const name of readdirSync(dir)) {
      if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) {
        continue;
      }
      const text = readFileSync(join(dir, name), 'utf8');
      if (BANNED.test(text)) {
        offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });
});