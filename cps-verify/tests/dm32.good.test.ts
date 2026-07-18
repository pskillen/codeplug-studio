import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/dm32/dm32-baofeng-dm32uv/good');

describe('dm32-baofeng-dm32uv good fixture', () => {
  it('verifies committed CRLF sample with exit-quality ok', async () => {
    const result = await verifyCodeplug({
      format: 'dm32',
      profile: 'dm32-baofeng-dm32uv',
      path: goodDir,
    });
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'dm32', path: goodDir });
    expect(result.profile).toBe('dm32-baofeng-dm32uv');
    expect(result.ok).toBe(true);
  });
});
