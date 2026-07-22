import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getVerifier } from '../src/formats/registry.ts';
import { verifyCodeplug } from '../src/verify.ts';
import { itEachCheckOutcome } from './assertCheckOutcomes.ts';
import { loadBundleDirSync } from './loadBundleSync.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/chirp/chirp-uv21/good');
const outcomes = getVerifier('chirp')!.verifyDetailed(loadBundleDirSync(goodDir), 'chirp-uv21');

describe('chirp-uv21 good fixture', () => {
  it('passes with explicit chirp-uv21 profile', async () => {
    const result = await verifyCodeplug({
      format: 'chirp',
      path: goodDir,
      profile: 'chirp-uv21',
    });
    expect(result.profile).toBe('chirp-uv21');
    expect(result.ok).toBe(true);
  });

  itEachCheckOutcome(outcomes);
});
