import { describe, expect, it } from 'vitest';
import { AT_D890_MEMORY_REGIONS } from './memoryRegionExport.ts';
import {
  buildAtD890WriteVerifyResult,
  captureAtD890WriteStagingSnapshot,
  sentinelSnapshotFromRegionDump,
} from './writeMemoryVerify.ts';
import {
  deserializeAtD890KeptPatches,
  deserializeAtD890KeptSnapshot,
  serializeAtD890KeptSnapshot,
} from './writeVerifyHooks.ts';
import { resolveAtD890SettingsPatches } from './settingsFields.ts';

function makeRegionFiles(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const region of AT_D890_MEMORY_REGIONS) {
    const total = region.chunks.reduce((sum, c) => sum + c.length, 0);
    files.set(region.id, new Uint8Array(total).fill(0x11));
  }
  return files;
}

function setByte(files: Map<string, Uint8Array>, address: number, value: number): void {
  for (const region of AT_D890_MEMORY_REGIONS) {
    let fileOff = 0;
    for (const chunk of region.chunks) {
      if (address >= chunk.address && address < chunk.address + chunk.length) {
        files.get(region.id)![fileOff + address - chunk.address] = value;
        return;
      }
      fileOff += chunk.length;
    }
  }
  throw new Error('address not in a region');
}

const META = { model: 'ID890UV', elapsedMs: 1, totalBytesRead: 1 };

describe('AT-D890 kept snapshot patches', () => {
  const patches = resolveAtD890SettingsPatches(
    [
      { fieldId: 'keyShortP1', value: 14 },
      { fieldId: 'keyShortP2', value: 13 },
    ],
    'mm9pdy',
  );

  function verifyWith(kept: ReturnType<typeof serializeAtD890KeptSnapshot>) {
    const before = deserializeAtD890KeptSnapshot(kept);
    const after = makeRegionFiles();
    setByte(after, 0x3500013, 14);
    setByte(after, 0x3500014, 13);
    return buildAtD890WriteVerifyResult(
      captureAtD890WriteStagingSnapshot([]),
      after,
      before,
      META,
      new Map(),
      deserializeAtD890KeptPatches(kept),
    );
  }

  it('round-trips the patches through the kept JSON and verifies', () => {
    const kept = JSON.parse(
      JSON.stringify(
        serializeAtD890KeptSnapshot(sentinelSnapshotFromRegionDump(makeRegionFiles()), patches),
      ),
    );
    expect(deserializeAtD890KeptPatches(kept)).toEqual(patches);
    const result = verifyWith(kept);
    expect(result.sentinel).toEqual({ ok: true });
    expect(result.ok).toBe(true);
  });

  it('verifies a payload stored before patches existed as it did before', () => {
    const kept = JSON.parse(
      JSON.stringify(
        serializeAtD890KeptSnapshot(sentinelSnapshotFromRegionDump(makeRegionFiles())),
      ),
    );
    expect(kept.patches).toBeUndefined();
    expect(deserializeAtD890KeptPatches(kept)).toEqual([]);
    const result = verifyWith(kept);
    expect(result.sentinel.ok).toBe(false);
  });
});
