import { describe, expect, it } from 'vitest';
import { AT_D890_MEMORY_REGIONS } from './memoryRegionExport.ts';
import {
  AT_D890_RMW_SPILL_REGION_ID,
  buildAtD890WriteVerifyResult,
  captureAtD890WriteStagingSnapshot,
  compareStagingAgainstRegionDump,
  formatAtD890WriteVerifyDebugMarkdown,
  isAtD890VolatileVerifyAddress,
  listStagingAddressesOutsideModelledRegions,
  sentinelSnapshotFromRegionDump,
  summarizeDownloadCacheStaleness,
  summarizeVerifyByRegion,
} from './writeMemoryVerify.ts';
import { cloneAtD890SentinelSnapshot } from './sentinelVerify.ts';
import { D890_MAP } from './constants.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';
import { putCacheBytes, type AtD890DownloadCache } from './memory.ts';

function makeRegionFiles(overrides: Record<string, Uint8Array>): Map<string, Uint8Array> {
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

  it('compares RMW spill chunks outside modelled regions when spill readback is supplied', () => {
    const files = makeRegionFiles({});
    const spillAddr = 0x2fa_0100;
    expect(
      listStagingAddressesOutsideModelledRegions(
        captureAtD890WriteStagingSnapshot([
          { address: spillAddr, data: new Uint8Array(16).fill(0xab) },
        ]),
      ),
    ).toEqual([spillAddr]);

    const expected = new Uint8Array(16).fill(0xab);
    const spillChunks = new Map([[spillAddr, expected]]);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: spillAddr, data: expected }]);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files, spillChunks);
    expect(mismatches).toHaveLength(0);
  });

  it('reports spill mismatch when readback differs', () => {
    const files = makeRegionFiles({});
    const spillAddr = 0x2fa_0200;
    const expected = new Uint8Array(16).fill(0x11);
    const actual = new Uint8Array(16).fill(0x22);
    const spillChunks = new Map([[spillAddr, actual]]);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: spillAddr, data: expected }]);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files, spillChunks);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]!.regionId).toBe(AT_D890_RMW_SPILL_REGION_ID);
    expect(mismatches[0]!.actual).toEqual(actual);
  });

  it('reports spill not_read when readback is missing (never fabricates 0xff)', () => {
    const files = makeRegionFiles({});
    const spillAddr = 0x2fa_0300;
    const expected = new Uint8Array(16).fill(0x33);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: spillAddr, data: expected }]);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]!.kind).toBe('not_read');
    expect(mismatches[0]!.regionId).toBe('unknown');
    expect(mismatches[0]!.actual).toBeNull();
  });

  it('skips erase-unit bookkeeping blocks outside modelled banks', () => {
    const files = makeRegionFiles({});
    const bookkeepingAddr = 0x348_0000 + 0x3fbf0;
    const staged = new Uint8Array(16);
    staged.set([0x22, 0x33, 0x44, 0x55], 0);
    const snapshot = captureAtD890WriteStagingSnapshot([
      { address: bookkeepingAddr, data: staged },
    ]);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files);
    expect(mismatches).toHaveLength(0);
  });

  it('compares bookkeeping blocks inside modelled region spans', () => {
    const files = makeRegionFiles({});
    const bookkeepingAddr = 0x3a0_0000 + 0x3fbf0;
    const staged = new Uint8Array(16);
    staged.set([0x22, 0x33, 0x44, 0x55], 4);
    const actual = new Uint8Array(16).fill(0xff);
    writeChunkAt(files, bookkeepingAddr, actual);
    const snapshot = captureAtD890WriteStagingSnapshot([
      { address: bookkeepingAddr, data: staged },
    ]);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]!.kind).toBe('mismatch');
    expect(mismatches[0]!.regionId).toBe('talkgroupData');
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

  it('includes spill region row when staged outside modelled banks', () => {
    const files = makeRegionFiles({});
    const spillAddr = 0x2fa_0400;
    const data = new Uint8Array(16).fill(0x55);
    const spillChunks = new Map([[spillAddr, data]]);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: spillAddr, data }]);
    const rows = summarizeVerifyByRegion(snapshot, files, [], spillChunks);
    const spill = rows.find((r) => r.id === AT_D890_RMW_SPILL_REGION_ID);
    expect(spill?.stagedChunkCount).toBe(1);
    expect(spill?.status).toBe('match');
  });

  it('marks regions with mismatches', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.ScanListSet;
    const expected = new Uint8Array(16).fill(1);
    const mismatch = {
      kind: 'mismatch' as const,
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
    afterFiles.set('localInfo', new Uint8Array(D890_MAP.LocalInfoLength).fill(0x99));
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

  it('excludes bookkeeping chunks from totals and pass/fail', () => {
    const files = makeRegionFiles({});
    const bookkeeping = 0x350_0000 + 0x3fff0;
    const data = new Uint8Array(16);
    data.set([0x55, 0x55, 0xaa, 0xaa], 0);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: bookkeeping, data }]);
    const result = buildAtD890WriteVerifyResult(snapshot, files, undefined, {
      model: 'ID890UV',
      elapsedMs: 100,
      totalBytesRead: 512,
    });
    expect(result.ok).toBe(true);
    expect(result.staging.totalChunks).toBe(0);
    expect(result.staging.excludedBookkeepingChunks).toBe(1);
    expect(result.staging.mismatchedChunks).toBe(0);
    expect(result.staging.notReadChunks).toBe(0);
  });

  it('fails when an erase unit had must-change bytes but flash did not commit', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.ChannelSet;
    const preRadio = new Uint8Array(16).fill(0xff);
    const staged = new Uint8Array(16).fill(0xab);
    writeChunkAt(files, addr, preRadio);

    const preCache: AtD890DownloadCache = { blocks: new Map() };
    putCacheBytes(preCache, addr, preRadio);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data: staged }], {
      preWriteFromRadio: [{ address: addr, data: preRadio }],
      downloadCache: preCache,
    });

    const result = buildAtD890WriteVerifyResult(snapshot, files, undefined, {
      model: 'ID890UV',
      elapsedMs: 100,
      totalBytesRead: 512,
    });
    expect(result.ok).toBe(false);
    const unit = result.eraseUnits.find((u) => u.unitBase === eraseUnitBaseFor(addr));
    expect(unit?.verdict).toBe('not-committed');
    expect(unit?.mustChangeChunks).toBe(1);
    expect(unit?.changedChunks).toBe(0);
  });

  it('flags cache staleness when pre-write radio differs from download cache', () => {
    const addr = D890_MAP.ChannelSet;
    const radio = new Uint8Array(16).fill(0x02);
    const cached = new Uint8Array(16).fill(0x00);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data: radio }], {
      preWriteFromRadio: [{ address: addr, data: radio }],
      downloadCache: (() => {
        const cache: AtD890DownloadCache = { blocks: new Map() };
        putCacheBytes(cache, addr, cached);
        return cache;
      })(),
    });
    const staleness = summarizeDownloadCacheStaleness(
      snapshot.preWriteChunks,
      snapshot.downloadCacheChunks,
    );
    expect(staleness?.differingChunks).toBe(1);
  });

  it('excludes volatile zone A/B channel tables from compare', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.ZoneAChannel;
    const staged = new Uint8Array(16).fill(0x00);
    const radio = new Uint8Array(16).fill(0x06);
    writeChunkAt(files, addr, radio);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data: staged }], {
      preWriteFromRadio: [{ address: addr, data: radio }],
    });
    expect(isAtD890VolatileVerifyAddress(addr)).toBe(true);
    const { mismatches } = compareStagingAgainstRegionDump(snapshot, files);
    expect(mismatches).toHaveLength(0);
  });
});

describe('formatAtD890WriteVerifyDebugMarkdown', () => {
  it('includes session context and full mismatch listing', () => {
    const files = makeRegionFiles({});
    const addr = D890_MAP.ChannelSet;
    const expected = new Uint8Array(16).fill(0xab);
    const actual = new Uint8Array(16).fill(0xcd);
    writeChunkAt(files, addr, actual);
    const snapshot = captureAtD890WriteStagingSnapshot([{ address: addr, data: expected }]);
    const result = buildAtD890WriteVerifyResult(snapshot, files, undefined, {
      model: 'ID890UV',
      elapsedMs: 500,
      totalBytesRead: 1024,
    });
    const md = formatAtD890WriteVerifyDebugMarkdown(result, {
      buildId: 'build-1',
      egressId: 'egress-1',
      formatId: 'anytone-at-d890uv',
      profileId: 'radio-io-at-d890uv',
      measuredAt: '2026-07-28T12:00:00.000Z',
      buildVersion: 'abc123',
      buildEnv: 'dev',
    });
    expect(md).toContain('# AT-D890UV write verify — debug report');
    expect(md).toContain('build-1');
    expect(md).toContain('channelSet');
    expect(md).toContain('0x');
    expect(md).toContain('Investigation hints');
    expect(md).toContain('ab ab ab');
    expect(md).toContain('cd cd cd');
  });
});
