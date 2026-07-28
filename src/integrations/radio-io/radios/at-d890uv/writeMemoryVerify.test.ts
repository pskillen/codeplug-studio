import { describe, expect, it } from 'vitest';
import { AT_D890_MEMORY_REGIONS } from './memoryRegionExport.ts';
import {
  buildAtD890WriteVerifyResult,
  captureAtD890WriteStagingSnapshot,
  compareStagingAgainstRegionDump,
  sentinelSnapshotFromRegionDump,
  summarizeVerifyByRegion,
} from './writeMemoryVerify.ts';
import { cloneAtD890SentinelSnapshot } from './sentinelVerify.ts';
import { D890_MAP } from './constants.ts';

function makeRegionFiles(
  overrides: Record<string, Uint8Array>,
): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const region of AT_D890_MEMORY_REGIONS) {
    const total = region.chunks.reduce((sum, c) => sum + c.length, 0);
    files.set(region.id, overrides[region.id] ?? new Uint8Array(total).fill(0xff));
  }
  return files;
}

function writeChunkAt(files: Map<string, Uint8Array>, address: number, data: Uint8Array): void {
  for (const region of AT_D890_MEMORY_REGIONS) {
    const file = files.get(region.id)!;
    let fileOff = 0;
    for (const chunk of region.chunks) {
      const chunkEnd = chunk.address + chunk.length;
      if (address >= chunk.address && address < chunkEnd) {
        const off = address - chunk.address;
        file.set(data, fileOff + off);
        return;
      }
      fileOff += chunk.length;
    }
  }
  throw new Error(`address 0x${address.toString(16)} not in any region`);
}

describe('compareStagingAgainstRegionDump', () => {
  it('passes when every staged chunk matches the dump', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.ChannelSet;
    const data = new Uint8Array(16).fill(0xab);
    writeChunkAt(files, addr, data);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data }]);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files);
    expect(mismatches).toHaveLength(0);
  });

  it('reports a mismatch when radio bytes differ', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.ChannelSet;
    const expected = new Uint8Array(16).fill(0xab);
    const actual = new Uint8Array(16).fill(0xcd);
    writeChunkAt(files, addr, actual);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data: expected }]);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]!.address).toBe(addr);
    expect(mismatches[0]!.regionId).toBe('channelSet');
  });
});

describe('sentinelSnapshotFromRegionDump', () => {
  it('extracts LocalInfo bytes from a region dump', () => {
    const files = makeRegionFiles({});
    const local = new Uint8Array(D890_MAP.LocalInfoLength).fill(0x42);
    files.set('localInfo', local);
    const snap = sentinelSnapshotFromRegionDump(files);
    expect(snap.get('LocalInfo')).toEqual(local);
  });
});

describe('summarizeVerifyByRegion', () => {
  it('marks unstaged regions as not_written', () => {
    const files = makeRegionFiles({});
    const snapshot = captureAtD890WriteStagingSnapshot([]);
    const rows = summarizeVerifyByRegion(snapshot, files, []);
    const channelSet = rows.find((r) => r.id === 'channelSet');
    expect(channelSet?.status).toBe('not_written');
  });

  it('marks regions with mismatches', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.ScanListSet;
    const expected = new Uint8Array(16).fill(1);
    const mismatch = {
      address: addr,
      regionId: 'scanListSet',
      regionLabel: 'Scan-list occupancy bitmap',
      expected,
      actual: new Uint8Array(16).fill(2),
    };
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data: expected }]);
    const rows = summarizeVerifyByRegion(snapshot, files, [mismatch]);
    expect(rows.find((r) => r.id === 'scanListSet')?.status).toBe('mismatch');
  });
});

describe('buildAtD890WriteVerifyResult', () => {
  it('fails when sentinel regions change', () => {
    const files = makeRegionFiles({});
    const before = sentinelSnapshotFromRegionDump(files);
    const afterFiles = makeRegionFiles({});
    afterFiles.set(
      'localInfo',
      new Uint8Array(D890_MAP.LocalInfoLength).fill(0x99),
    );
    const snapshot = captureAtD890WriteStagingSnapshot([]);
    const result = buildAtD890WriteVerifyResult(
      snapshot,
      afterFiles,
      cloneAtD890SentinelSnapshot(before),
      { model: 'ID890UV', elapsedMs: 1000, totalBytesRead: 512 },
    );
    expect(result.ok).toBe(false);
    expect(result.sentinel.ok).toBe(false);
  });

  it('passes when staging and sentinel both match', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.MasterIdData;
    const data = new Uint8Array(16).fill(0x11);
    writeChunkAt(files, addr, data);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data }]);
    const before = sentinelSnapshotFromRegionDump(files);
    const result = buildAtD890WriteVerifyResult(snapshot, files, before, {
      model: 'ID890UV',
      elapsedMs: 500,
      totalBytesRead: 1024,
    });
    expect(result.ok).toBe(true);
  });
});
