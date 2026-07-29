import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  captureWriteVerifyStaging,
  compareStagingAgainstLookup,
  memoryMapByteLookup,
  regionAtFromManifest,
} from '../../writeVerifyCompare.ts';
import { UV5R_MINI_LAYOUT } from './layout.ts';
import { packedOffsetForRadioAddr } from './protocol.ts';
import { buildUv17ProRegionManifest } from './writeRole.ts';
import { createUv17ProWriteVerifyHooks } from './writeVerifyHooks.ts';

const MANIFEST = buildUv17ProRegionManifest(UV5R_MINI_LAYOUT).map((r) => ({
  id: r.id,
  label: r.label,
  group: r.writeRole,
  start: r.packedOffset,
  length: r.sizeBytes,
}));

describe('UV-17Pro write verify hooks', () => {
  it('exports hooks with soft reconnect', () => {
    const hooks = createUv17ProWriteVerifyHooks(UV5R_MINI_LAYOUT);
    expect(hooks.requiresCrossSessionReconnect).toBe(false);
  });

  it('maps radio-address staging through packed offsets for compare', () => {
    const image = createMemoryMap(UV5R_MINI_LAYOUT.memTotal);
    const radioAddr = UV5R_MINI_LAYOUT.memStarts[1]!;
    const packed = packedOffsetForRadioAddr(UV5R_MINI_LAYOUT, radioAddr);
    const block = new Uint8Array(UV5R_MINI_LAYOUT.blockSize).fill(0x42);
    image.set(packed, block);

    const staging = captureWriteVerifyStaging([{ address: radioAddr, data: block }]);
    const mismatches = compareStagingAgainstLookup(
      staging,
      memoryMapByteLookup(image, (addr) => packedOffsetForRadioAddr(UV5R_MINI_LAYOUT, addr)),
      (addr) => {
        const packedAddr = packedOffsetForRadioAddr(UV5R_MINI_LAYOUT, addr);
        return regionAtFromManifest(MANIFEST, packedAddr);
      },
    );
    expect(mismatches).toHaveLength(0);
  });
});
