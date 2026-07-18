import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getVerifier } from '../src/formats/registry.ts';
import { verifyCodeplug } from '../src/verify.ts';
import { itEachCheckOutcome } from './assertCheckOutcomes.ts';
import { loadBundleDirSync } from './loadBundleSync.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/dm32/dm32-baofeng-dm32uv/good');
const outcomes = getVerifier('dm32')!.verifyDetailed(
  loadBundleDirSync(goodDir),
  'dm32-baofeng-dm32uv',
);

describe('dm32-baofeng-dm32uv good fixture', () => {
  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'dm32', path: goodDir });
    expect(result.profile).toBe('dm32-baofeng-dm32uv');
    expect(result.ok).toBe(true);
  });

  itEachCheckOutcome(outcomes);
});
