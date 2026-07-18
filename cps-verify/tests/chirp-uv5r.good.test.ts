import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/chirp/chirp-uv5r/good');

describe('chirp-uv5r good fixture', () => {
  it('verifies committed LF sample with exit-quality ok', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      profile: 'chirp-uv5r',
      path: goodDir,
    });
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'chirp', path: goodDir });
    expect(result.profile).toBe('chirp-uv5r');
    expect(result.ok).toBe(true);
  });
});
