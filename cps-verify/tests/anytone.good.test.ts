import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/anytone/anytone-at-d890uv/good');

describe('anytone-at-d890uv good fixture', () => {
  it('verifies committed CRLF sample with exit-quality ok', async () => {
    const result = await verifyCodeplug({
      format: 'anytone',
      profile: 'anytone-at-d890uv',
      path: goodDir,
    });
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'anytone', path: goodDir });
    expect(result.profile).toBe('anytone-at-d890uv');
    expect(result.ok).toBe(true);
  });
});
