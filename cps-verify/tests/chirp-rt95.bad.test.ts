import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = (name: string) => path.join(root, 'fixtures/chirp/chirp-rt95/bad', name);

describe('chirp-rt95 bad fixtures', () => {
  it('fails on wrong headers', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      path: bad('wrong-headers'),
      profile: 'chirp-rt95',
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'headers')).toBe(true);
  });

  it('fails when channel name exceeds profile limit (6)', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      path: bad('over-long-name'),
      profile: 'chirp-rt95',
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'name-length')).toBe(true);
  });

  it('fails when row count exceeds max memory slots (200)', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      path: bad('over-slots'),
      profile: 'chirp-rt95',
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'cardinality')).toBe(true);
  });
});
