/**
 * Import boundary for the storage-claim sender. Only this folder and the wizard hook may import it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const CLAIM_DIR = ['integrations', 'radio-io', 'radios', 'radiofoundry', 'storageClaim'].join(sep);
const HOOK = join('app', 'routes', 'builds', 'danger-zone', 'storageClaim', 'useStorageClaimFlow.tsx');

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

function offenders(needle: RegExp, allowed: (rel: string) => boolean): string[] {
  return files.filter((f) => needle.test(f.text) && !allowed(f.rel)).map((f) => f.rel);
}

describe('storage-claim send boundary (interlock 10)', () => {
  const allowed = (rel: string) =>
    rel.startsWith(CLAIM_DIR + sep) || rel === HOOK || rel === join(CLAIM_DIR, 'storageClaimBoundary.test.ts');

  it('only storageClaim/ and the wizard hook reference storageClaimSend', () => {
    expect(offenders(/storageClaimSend/, allowed)).toEqual([]);
  });

  it('only storageClaim/ and the wizard hook reference buildStorageClaimTokenPayload', () => {
    expect(offenders(/buildStorageClaimTokenPayload/, allowed)).toEqual([]);
  });

  it('the barrel does not export the sender', () => {
    const barrel = files.find((f) => f.rel === join(CLAIM_DIR, 'index.ts'))!;
    expect(barrel.text).not.toMatch(/storageClaimSend|createStorageClaimSender/);
  });
});