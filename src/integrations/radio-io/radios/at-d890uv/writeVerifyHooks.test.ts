import { describe, expect, it } from 'vitest';
import {
  AIRSECURITY_SEED_ADDRESS,
  AIRSECURITY_SEED_FIELD_ID,
  AIRSECURITY_SEED_RECORD_LENGTH,
  encodeAirSecuritySeedRecord,
} from './airSecuritySeed.ts';
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

const SECRET = new TextEncoder().encode('12345678901234567890');

/** Bytes 4..11 of the record, the way JSON.stringify writes a number array. */
function seedByteRun(record: Uint8Array): string {
  return [...record.subarray(4, 12)].join(',');
}

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

  it('drops a seed-field patch and zeros any other byte inside the seed span', () => {
    const record = encodeAirSecuritySeedRecord(SECRET);
    const seedPatch = {
      fieldId: AIRSECURITY_SEED_FIELD_ID,
      address: AIRSECURITY_SEED_ADDRESS,
      bytes: record,
      mask: new Uint8Array(AIRSECURITY_SEED_RECORD_LENGTH).fill(0xff),
    };
    const overlapping = {
      fieldId: 'not-the-seed',
      address: AIRSECURITY_SEED_ADDRESS - 1,
      bytes: Uint8Array.of(0x11, record[0]!),
      mask: Uint8Array.of(0xff, 0xff),
    };
    const kept = JSON.parse(
      JSON.stringify(
        serializeAtD890KeptSnapshot(sentinelSnapshotFromRegionDump(makeRegionFiles()), [
          ...patches,
          seedPatch,
          overlapping,
        ]),
      ),
    );
    const json = JSON.stringify(kept);
    expect(json).not.toContain(seedByteRun(record));
    const stored = deserializeAtD890KeptPatches(kept);
    expect(stored.map((p) => p.fieldId)).toEqual(['keyShortP1', 'keyShortP2', 'not-the-seed']);
    const redacted = stored.find((p) => p.fieldId === 'not-the-seed')!;
    expect([...redacted.bytes]).toEqual([0x11, 0]);
    expect([...redacted.mask]).toEqual([0xff, 0]);
  });
});
