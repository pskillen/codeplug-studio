import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = (name: string) => path.join(root, 'fixtures/dm32/dm32-baofeng-dm32uv/bad', name);

describe('dm32-baofeng-dm32uv bad fixtures', () => {
  it('fails on LF-only line endings', async () => {
    const result = await verifyCodeplug({ format: 'dm32', path: bad('lf-endings') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'line-endings')).toBe(true);
  });

  it('fails on dangling zone channel foreign keys', async () => {
    const result = await verifyCodeplug({ format: 'dm32', path: bad('dangling-fk') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'foreign-key')).toBe(true);
  });

  it('fails when scan member count exceeds profile limit', async () => {
    const result = await verifyCodeplug({ format: 'dm32', path: bad('over-limit') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'cardinality')).toBe(true);
  });
});
