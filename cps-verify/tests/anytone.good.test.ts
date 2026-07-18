import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getVerifier } from '../src/formats/registry.ts';
import { verifyCodeplug } from '../src/verify.ts';
import { itEachCheckOutcome } from './assertCheckOutcomes.ts';
import { loadBundleDirSync } from './loadBundleSync.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/anytone/anytone-at-d890uv/good');
const outcomes = getVerifier('anytone')!.verifyDetailed(
  loadBundleDirSync(goodDir),
  'anytone-at-d890uv',
);

describe('anytone-at-d890uv good fixture', () => {
  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'anytone', path: goodDir });
    expect(result.profile).toBe('anytone-at-d890uv');
    expect(result.ok).toBe(true);
  });

  itEachCheckOutcome(outcomes);
});
