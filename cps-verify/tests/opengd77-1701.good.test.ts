import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getVerifier } from '../src/formats/registry.ts';
import { verifyCodeplug } from '../src/verify.ts';
import { itEachCheckOutcome } from './assertCheckOutcomes.ts';
import { loadBundleDirSync } from './loadBundleSync.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goodDir = path.join(root, 'fixtures/opengd77/opengd77-1701/good');
const outcomes = getVerifier('opengd77')!.verifyDetailed(
  loadBundleDirSync(goodDir),
  'opengd77-1701',
);

describe('opengd77-1701 good fixture', () => {
  it('defaults profile when --profile omitted', async () => {
    const result = await verifyCodeplug({ format: 'opengd77', path: goodDir });
    expect(result.profile).toBe('opengd77-1701');
    expect(result.ok).toBe(true);
  });

  itEachCheckOutcome(outcomes);
});
