import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = (name: string) => path.join(root, 'fixtures/chirp/chirp-uv21/bad', name);

describe('chirp-uv21 bad fixtures', () => {
  it('fails on wrong headers', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      path: bad('wrong-headers'),
      profile: 'chirp-uv21',
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'headers')).toBe(true);
  });

  it('fails when channel name exceeds profile limit (12)', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      path: bad('over-long-name'),
      profile: 'chirp-uv21',
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'name-length')).toBe(true);
  });

  it('fails when row count exceeds max memory slots (1000)', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      path: bad('over-slots'),
      profile: 'chirp-uv21',
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'cardinality')).toBe(true);
  });
});
