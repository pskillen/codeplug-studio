import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getVerifier } from '../src/formats/registry.ts';
import { verifyCodeplug } from '../src/verify.ts';
import { itEachCheckOutcome } from './assertCheckOutcomes.ts';
import { loadBundleDirSync } from './loadBundleSync.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/chirp/chirp-uv5r/good');
const outcomes = getVerifier('chirp')!.verifyDetailed(loadBundleDirSync(goodDir), 'chirp-uv5r');

describe('chirp-uv5r good fixture', () => {
  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'chirp', path: goodDir });
    expect(result.profile).toBe('chirp-uv5r');
    expect(result.ok).toBe(true);
  });

  itEachCheckOutcome(outcomes);
});
