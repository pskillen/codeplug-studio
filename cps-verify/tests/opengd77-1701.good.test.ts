import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/opengd77/opengd77-1701/good');

describe('opengd77-1701 good fixture', () => {
  it('verifies committed LF sample with exit-quality ok', async () => {
    const result = await verifyCodeplug({
      format: 'opengd77',
      profile: 'opengd77-1701',
      path: goodDir,
    });
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'opengd77', path: goodDir });
    expect(result.profile).toBe('opengd77-1701');
    expect(result.ok).toBe(true);
  });
});
