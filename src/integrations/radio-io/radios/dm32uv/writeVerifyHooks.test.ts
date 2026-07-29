import { describe, expect, it } from 'vitest';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import {
  captureWriteVerifyStaging,
  compareStagingAgainstLookup,
  regionAtFromManifest,
  sparseBlockByteLookup,
} from '../../writeVerifyCompare.ts';

function blockManifest(addr: number) {
  return [
    {
      id: `block_${addr.toString(16)}`,
      label: 'Zone data',
      group: 'replaced',
      start: addr,
      length: DM32_BLOCK_SIZE,
    },
  ] as const;
}

describe('DM32 write verify compare', () => {
  it('matches staged 4 KB blocks against sparse read-back', () => {
    const data = new Uint8Array(DM32_BLOCK_SIZE).fill(0xaa);
    data[DM32_BLOCK_SIZE - 1] = DM32_METADATA.ZONE;
    const addr = 0x10000;
    const staging = captureWriteVerifyStaging([{ address: addr, data }]);
    const manifest = blockManifest(addr);
    const readBlocks = new Map([[addr, data.slice()]]);
    const mismatches = compareStagingAgainstLookup(
      staging,
      sparseBlockByteLookup(readBlocks),
      (a) => regionAtFromManifest(manifest, a),
    );
    expect(mismatches).toHaveLength(0);
  });

  it('detects block mismatch', () => {
    const expected = new Uint8Array(DM32_BLOCK_SIZE).fill(0x11);
    const actual = new Uint8Array(DM32_BLOCK_SIZE).fill(0x22);
    const addr = 0x20000;
    const staging = captureWriteVerifyStaging([{ address: addr, data: expected }]);
    const manifest = blockManifest(addr);
    const mismatches = compareStagingAgainstLookup(
      staging,
      sparseBlockByteLookup(new Map([[addr, actual]])),
      (a) => regionAtFromManifest(manifest, a),
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.kind).toBe('mismatch');
  });
});
