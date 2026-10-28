import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RadioSession } from '../../types.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  buildWriteVerifyResult,
  captureWriteVerifyStaging,
  compareStagingAgainstLookup,
  memoryMapByteLookup,
  regionAtFromManifest,
  summarizeWriteVerifyRegions,
} from '../../writeVerifyCompare.ts';
import { RT95_BLOCK_SIZE, RT95_IMAGE_SIZE } from './constants.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { RT95_REGION_MANIFEST } from './writeRole.ts';
import { createFakeRt95Pipe } from './__fixtures__/fakeRt95Pipe.ts';
import { Rt95Protocol, setRt95EndAtForTests, setRt95RetryTuningForTests } from './protocol.ts';
import { RT95_WRITE_VERIFY_HOOKS } from './writeVerifyHooks.ts';

const MANIFEST = RT95_REGION_MANIFEST.map((r) => ({
  id: r.id,
  label: r.label,
  group: r.role,
  start: r.offset,
  length: r.length,
}));

describe('RT95 write verify compare', () => {
  it('matches staged clone blocks against identical read image', () => {
    const bytes = buildSyntheticRt95Image();
    const image = memoryMapFromBytes(bytes);
    const chunks: { address: number; data: Uint8Array }[] = [];
    for (let addr = 0; addr < RT95_IMAGE_SIZE; addr += RT95_BLOCK_SIZE) {
      if (addr > 0x3290) break;
      chunks.push({ address: addr, data: image.get(addr, RT95_BLOCK_SIZE) });
    }
    const staging = captureWriteVerifyStaging(chunks);
    const mismatches = compareStagingAgainstLookup(staging, memoryMapByteLookup(image), (addr) =>
      regionAtFromManifest(MANIFEST, addr),
    );
    expect(mismatches).toHaveLength(0);
    const result = buildWriteVerifyResult({
      model: 'retevis-rt95',
      elapsedMs: 1,
      totalBytesRead: RT95_IMAGE_SIZE,
      staging,
      mismatches,
      regions: summarizeWriteVerifyRegions(staging, mismatches, MANIFEST, () => 0x10),
      regionGroups: [],
    });
    expect(result.ok).toBe(true);
  });

  it('detects a corrupted channel block', () => {
    const original = buildSyntheticRt95Image();
    const corrupted = original.slice();
    corrupted[4] = 0xff;
    const image = memoryMapFromBytes(corrupted);
    const staging = captureWriteVerifyStaging([
      { address: 0x0000, data: original.subarray(0, RT95_BLOCK_SIZE) },
    ]);
    const mismatches = compareStagingAgainstLookup(staging, memoryMapByteLookup(image), (addr) =>
      regionAtFromManifest(MANIFEST, addr),
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.kind).toBe('mismatch');
    expect(mismatches[0]?.regionId).toBe('channels');
  });
});

describe('RT95 runVerify straight after Write (#1461)', () => {
  beforeEach(() => {
    setRt95EndAtForTests(0);
    setRt95RetryTuningForTests({ intervalMs: 20, budgetMs: 400, timeoutMs: 10 });
  });
  afterEach(() => {
    setRt95EndAtForTests(0);
    setRt95RetryTuningForTests({});
  });

  it('succeeds although the radio ignores PROGRAM for a while after END', async () => {
    const pipe = createFakeRt95Pipe({ deafAfterEndMs: 60 });
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    const bytes = buildSyntheticRt95Image();
    bytes[0x0100] = 0x42;
    await radio.upload(memoryMapFromBytes(bytes), {});

    const session = { radio, pipe } as unknown as RadioSession;
    const pending = RT95_WRITE_VERIFY_HOOKS.captureAfterUpload(session);
    expect(pending).toBeDefined();
    const result = await RT95_WRITE_VERIFY_HOOKS.runVerify(session, pending!);

    expect(result.ok).toBe(true);
    const programs = pipe.writes.filter((w) => new TextDecoder().decode(w) === 'PROGRAM');
    expect(programs.length).toBeGreaterThan(2);
  });
});
