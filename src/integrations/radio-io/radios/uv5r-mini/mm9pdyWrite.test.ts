/**
 * UV-5R Mini MM9PDY Write: the zone table frames after the stock blocks, the write-safety rules around them,
 * and write verify. Fakes only: the fake radio models the external flash (a W to a 4 KiB-aligned address
 * erases that sector first, as the radio's clone handler does).
 */

import { describe, expect, it } from 'vitest';
import type { MemoryMap, ProgressUpdate, RadioSession } from '../../types.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';
import { RadioWrongIdentError } from '../../kit/errors.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { uv17ProBackupMemSpans } from '../uv17pro-family/backupRestoreRoles.ts';
import { UV5R_MINI_LAYOUT as layout } from '../uv17pro-family/layout.ts';
import type { Uv17ProExtraUploadFrames } from '../uv17pro-family/protocol.ts';
import { FakeMiniRadio as FakeRadio } from './__fixtures__/fakeMiniRadio.ts';
import { UV5R_MINI_DESCRIPTOR } from './descriptor.ts';
import {
  decodeUv5rMiniZoneTable,
  encodeUv5rMiniZoneTable,
  MMZ1_BASE,
  MMZ1_END,
  type Uv5rMiniZoneTableInput,
} from './modData/index.ts';
import { UV5R_MINI_ZONE_TABLE_STAGE, Uv5rMiniProtocol } from './protocol.ts';
import {
  assertUv5rMiniWriteAllowed,
  Uv5rMiniWriteRefusedError,
  type Uv5rMiniWriteContext,
} from './writeInterlock.ts';
import {
  uv5rMiniArchiveImageWithZoneTable,
  uv5rMiniZoneBackupRegion,
  uv5rMiniZoneRestoreFrames,
  uv5rMiniZoneTableFrameAddresses,
} from './zoneBackup.ts';

function range(start: number, size: number): number[] {
  const out: number[] = [];
  for (let a = start; a < start + size; a += 0x40) out.push(a);
  return out;
}

/** The stock Mini Write, block for block (the SZ1 plan snapshot). */
const STOCK_PLAN = [...range(0x0000, 0x8040), ...range(0x9000, 0x40), ...range(0xa000, 0x1c0)];

function zones(n: number): Uv5rMiniZoneTableInput {
  return {
    zones: Array.from({ length: n }, (_, i) => ({
      name: `Zone ${String(i + 1).padStart(2, '0')}`,
      slotIndexes: [i, i + 100, 998 - i],
    })),
  };
}

async function connected(proto = new Uv5rMiniProtocol(), pipe = new FakeRadio()) {
  await proto.connect(pipe, { handshake: 'none' });
  pipe.writes.length = 0;
  return { pipe, proto };
}

async function writeZones(intent: Uv5rMiniZoneTableInput | null, pipe = new FakeRadio()) {
  const { proto } = await connected(new Uv5rMiniProtocol(), pipe);
  proto.setZoneIntent(intent);
  const events: ProgressUpdate[] = [];
  await proto.upload(createMemoryMap(layout.memTotal), { onProgress: (p) => events.push(p) });
  return { pipe, proto, events };
}

describe('UV-5R Mini MM9PDY Write frame plan', () => {
  it.each([0, 1, 24])(
    '%i zones: the stock blocks unchanged, then the table in codec order',
    async (n) => {
      const intent = zones(n);
      const { pipe } = await writeZones(intent);
      const table = encodeUv5rMiniZoneTable(intent).frames.map((f) => f.address);
      expect(pipe.wAddresses()).toEqual([...STOCK_PLAN, ...table]);
      expect(table).toHaveLength(n === 0 ? 1 : 1 + Math.ceil(n / 4) + 2 * n);
    },
  );

  it('the header frame at 0xC000 is the first table frame, after every stock block', async () => {
    for (const n of [0, 1, 5, 24]) {
      const { pipe } = await writeZones(zones(n));
      const addrs = pipe.wAddresses();
      const first = addrs.findIndex((a) => a >= MMZ1_BASE);
      expect(first).toBe(STOCK_PLAN.length);
      expect(addrs[first]).toBe(0xc000);
      expect(addrs.filter((a) => a === 0xc000)).toHaveLength(1);
    }
  });

  it('writes exactly the encoded bytes, and the radio decodes the full table', async () => {
    const intent = zones(24);
    const { pipe } = await writeZones(intent);
    const encoded = encodeUv5rMiniZoneTable(intent);
    expect(pipe.sector()).toEqual(encoded.sector);
    const decoded = decodeUv5rMiniZoneTable(pipe.sector());
    expect('zones' in decoded && decoded.zones.map((z) => z.name)).toEqual(
      intent.zones.map((z) => z.name),
    );
  });

  it('every prefix of the table frames decodes to no table or the full table, never other zones', () => {
    for (const n of [1, 3, 24]) {
      const encoded = encodeUv5rMiniZoneTable(zones(n));
      for (let k = 0; k <= encoded.frames.length; k++) {
        const sector = new Uint8Array(MMZ1_END - MMZ1_BASE).fill(0xff);
        for (const f of encoded.frames.slice(0, k)) sector.set(f.bytes, f.address - MMZ1_BASE);
        const decoded = decodeUv5rMiniZoneTable(sector);
        if (k < encoded.frames.length) {
          expect('reject' in decoded).toBe(true);
        } else {
          expect('zones' in decoded && decoded.generation).toBe(encoded.generation);
        }
      }
    }
  });

  it('an interrupted Write over an older table leaves no table, never mixed zones', async () => {
    const pipe = new FakeRadio();
    await writeZones(zones(24), pipe);
    const second = encodeUv5rMiniZoneTable(zones(2));
    for (let cut = 1; cut < second.frames.length; cut++) {
      const radio = new FakeRadio();
      radio.flash.set(pipe.flash);
      radio.ackLimit = STOCK_PLAN.length + cut;
      await expect(writeZones(zones(2), radio)).rejects.toThrow();
      expect('reject' in decodeUv5rMiniZoneTable(radio.sector())).toBe(true);
    }
  });

  it('reports progress as Upload, then Zone table, each over its own count', async () => {
    const { events } = await writeZones(zones(3));
    const labels = [...new Set(events.map((e) => e.stage))];
    expect(labels).toEqual(['Upload', UV5R_MINI_ZONE_TABLE_STAGE]);
    const table = events.filter((e) => e.stage === UV5R_MINI_ZONE_TABLE_STAGE);
    expect(table.at(-1)).toMatchObject({ cur: 1 + 1 + 6, max: 1 + 1 + 6 });
    expect(events.filter((e) => e.stage === 'Upload').at(-1)).toMatchObject({
      cur: STOCK_PLAN.length,
      max: STOCK_PLAN.length,
    });
  });
});

describe('UV-5R Mini MM9PDY table generation across two Writes', () => {
  it('an identical rewrite keeps the generation and the sector byte for byte', async () => {
    const pipe = new FakeRadio();
    await writeZones(zones(5), pipe);
    const first = pipe.sector();
    await writeZones(zones(5), pipe);
    expect(pipe.sector()).toEqual(first);
    const a = encodeUv5rMiniZoneTable(zones(5));
    const b = encodeUv5rMiniZoneTable(zones(5));
    expect(b.generation).toBe(a.generation);
    expect(b.sector).toEqual(a.sector);
  });

  it('a smaller second table replaces the first completely (the header erases the sector)', async () => {
    const pipe = new FakeRadio();
    await writeZones(zones(24), pipe);
    await writeZones(zones(2), pipe);
    const second = encodeUv5rMiniZoneTable(zones(2));
    expect(pipe.sector()).toEqual(second.sector);
    const decoded = decodeUv5rMiniZoneTable(pipe.sector());
    expect('zones' in decoded && decoded.generation).toBe(second.generation);
    expect(second.generation).not.toBe(encodeUv5rMiniZoneTable(zones(24)).generation);
  });

  it('an empty table retires an older one', async () => {
    const pipe = new FakeRadio();
    await writeZones(zones(4), pipe);
    await writeZones({ zones: [] }, pipe);
    const decoded = decodeUv5rMiniZoneTable(pipe.sector());
    expect('zones' in decoded && decoded.zones).toEqual([]);
    expect(
      pipe
        .sector()
        .subarray(0x40)
        .every((b) => b === 0xff),
    ).toBe(true);
  });
});

function blankSector(): Uint8Array {
  return new Uint8Array(MMZ1_END - MMZ1_BASE).fill(0xff);
}

/** A backup archive as `openRadioBackupZip` rebuilds it: the packed clone at 0, the table (if any) at 0xC000. */
function archiveFor(
  sector: Uint8Array,
  opts: { withZones: boolean; clone?: Uint8Array },
): { manifest: RadioBackupManifestV1; image: MemoryMap } {
  const clone = createMemoryMap(layout.memTotal);
  if (opts.clone) clone.set(0, opts.clone);
  const regions: RadioBackupManifestV1['regions'] = uv17ProBackupMemSpans(layout).map((s) => ({
    id: s.id,
    label: s.id,
    address: s.packedOffset,
    byteLength: s.size,
    path: `regions/${s.id}.bin`,
    restoreRole: 'restorable' as const,
  }));
  if (opts.withZones) regions.push(uv5rMiniZoneBackupRegion(sector).region);
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-11-12T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: layout.radioModelId,
    descriptorLabel: layout.protocolLabel,
    coverage: 'full-clone',
    imageByteLength: layout.memTotal,
    regions,
  };
  const image = opts.withZones ? uv5rMiniArchiveImageWithZoneTable(clone, sector) : clone;
  return { manifest, image };
}

describe('UV-5R Mini MM9PDY write safety', () => {
  const STOCK_SPANS: readonly (readonly [number, number])[] = [
    [0x0000, 0x8040],
    [0x9000, 0x9040],
    [0xa000, 0xa1c0],
  ];
  const MM9PDY_SPANS = [...STOCK_SPANS, [0xc000, 0xd000] as const];
  const inSpans = (a: number, spans: readonly (readonly [number, number])[]) =>
    spans.some(([s, e]) => a >= s && a + 0x40 <= e);
  const allowed = (a: number, ctx: Uv5rMiniWriteContext): boolean => {
    try {
      assertUv5rMiniWriteAllowed(a, 0x40, ctx);
      return true;
    } catch (e) {
      expect(e).toBeInstanceOf(Uv5rMiniWriteRefusedError);
      return false;
    }
  };
  const every64 = range(0x0000, 0x12000);

  it('the mm9pdy profile allows the stock spans plus 0xC000-0xCFC0 and nothing else, write and restore', () => {
    for (const operation of ['write', 'restore'] as const) {
      const ctx = { profile: 'mm9pdy', operation } as const;
      const got = every64.filter((a) => allowed(a, ctx));
      expect(got).toEqual(every64.filter((a) => inSpans(a, MM9PDY_SPANS)));
      expect(got.filter((a) => a >= 0xc000)).toEqual(range(0xc000, 0x1000));
    }
  });

  it('the stock profile is unchanged: the stock spans only', () => {
    for (const operation of ['write', 'restore'] as const) {
      const ctx = { profile: 'stock', operation } as const;
      expect(every64.filter((a) => allowed(a, ctx))).toEqual(
        every64.filter((a) => inSpans(a, STOCK_SPANS)),
      );
    }
  });

  it('never 0xF000 and up, never 0xE000-0xEFFF, never the log sectors beyond the stock frames', () => {
    const contexts: Uv5rMiniWriteContext[] = [
      { profile: 'mm9pdy', operation: 'write' },
      { profile: 'mm9pdy', operation: 'restore' },
      { profile: 'stock', operation: 'write' },
      { profile: 'stock', operation: 'restore' },
    ];
    for (const ctx of contexts) {
      for (const a of range(0xe000, 0x4000)) expect(allowed(a, ctx)).toBe(false);
      for (const a of range(0xb000, 0x1000)) expect(allowed(a, ctx)).toBe(false);
      for (const a of range(0xd000, 0x1000)) expect(allowed(a, ctx)).toBe(false);
      // 0x8000 and 0x9000: the stock clone's one frame each (VFO and settings), nothing past it.
      for (const a of range(0x8040, 0xfc0)) expect(allowed(a, ctx)).toBe(false);
      for (const a of range(0x9040, 0xfc0)) expect(allowed(a, ctx)).toBe(false);
    }
  });

  it('the zone table frames themselves stay inside 0xC000-0xCFC0 for every table size', () => {
    for (let n = 0; n <= 24; n++) {
      for (const f of encodeUv5rMiniZoneTable(zones(n)).frames) {
        expect(f.address).toBeGreaterThanOrEqual(0xc000);
        expect(f.address).toBeLessThanOrEqual(0xcfc0);
        expect(f.address % 0x40).toBe(0);
        expect(f.bytes).toHaveLength(0x40);
      }
    }
  });

  // SZ6 relaxed SZ5's "Restore never carries the table": the zone table region now restores on the MM9PDY
  // Backup / Restore profile (see the Backup and Restore describe below). What still holds is tested here.
  it("a Write's zone intent does not widen Restore: it runs on the Backup / Restore profile, stock by default", async () => {
    const { pipe, proto } = await connected();
    proto.setZoneIntent(zones(3));
    expect(proto.getWriteProfile()).toBe('mm9pdy');
    const { manifest, image } = archiveFor(blankSector(), { withZones: true });
    await expect(
      proto.restoreFromBackup(
        { manifest, image },
        { regionIds: ['mem-0', 'mem-1', 'mem-2', 'zones'] },
      ),
    ).rejects.toThrow(/MM9PDY target only/);
    expect(pipe.writes).toHaveLength(0);
    expect(proto.getWriteProfile()).toBe('stock');
    await proto.restoreFromBackup({ manifest, image }, { regionIds: ['mem-0', 'mem-1', 'mem-2'] });
    expect(pipe.wAddresses()).toEqual(STOCK_PLAN);
  });

  it('a crafted region outside the clone and the table is refused on both profiles, before any frame', async () => {
    for (const profile of ['stock', 'mm9pdy'] as const) {
      const { pipe, proto } = await connected();
      proto.setBackupRestoreProfile(profile);
      const { manifest, image } = archiveFor(blankSector(), { withZones: true });
      const extra = {
        ...manifest,
        regions: [
          ...manifest.regions,
          {
            id: 'mem-3',
            label: 'mem-3',
            address: 0xc000,
            byteLength: 0x40,
            path: 'regions/mem-3.bin',
            restoreRole: 'restorable' as const,
          },
        ],
      };
      await expect(
        proto.restoreFromBackup(
          { manifest: extra, image },
          { regionIds: ['mem-0', 'mem-1', 'mem-2', 'mem-3'] },
        ),
      ).rejects.toThrow(/outside the write set/);
      expect(pipe.writes).toHaveLength(0);
    }
  });

  it('a Restore outside the spans is refused on the mm9pdy profile', () => {
    const ctx = { profile: 'mm9pdy', operation: 'restore' } as const;
    for (const a of [0xb000, 0xd000, 0xe000, 0xf000, 0x8040, 0x9040, 0xa1c0, 0xbfc0]) {
      expect(() => assertUv5rMiniWriteAllowed(a, 0x40, ctx)).toThrow(Uv5rMiniWriteRefusedError);
    }
  });

  it('the model check runs before any write: a radio that is not a Mini gets no W frame', async () => {
    const pipe = new FakeRadio(new TextEncoder().encode('NOTAMINI'));
    const { proto } = await connected(new Uv5rMiniProtocol(), pipe);
    proto.setZoneIntent(zones(3));
    await expect(proto.upload(createMemoryMap(layout.memTotal), {})).rejects.toThrow(
      RadioWrongIdentError,
    );
    expect(pipe.wAddresses()).toEqual([]);
  });

  it('the interlock runs before any frame: a table frame outside the spans sends nothing', async () => {
    class BadFrames extends Uv5rMiniProtocol {
      constructor(private readonly at: number) {
        super();
      }
      protected override extraUploadFrames(): Uv17ProExtraUploadFrames {
        return { stage: 'Zone table', frames: [{ address: this.at, bytes: new Uint8Array(0x40) }] };
      }
    }
    for (const at of [0xd000, 0xe000, 0xf000, 0xb000, 0x8040]) {
      const proto = new BadFrames(at);
      proto.setZoneIntent(zones(1));
      const { pipe } = await connected(proto);
      await expect(proto.upload(createMemoryMap(layout.memTotal), {})).rejects.toThrow(
        Uv5rMiniWriteRefusedError,
      );
      expect(pipe.writes).toHaveLength(0);
    }
  });

  it('without a zone intent the profile is stock, so even a 0xC000 frame is refused', async () => {
    class SneakyFrames extends Uv5rMiniProtocol {
      protected override extraUploadFrames(): Uv17ProExtraUploadFrames {
        return { stage: 'Zone table', frames: [{ address: 0xc000, bytes: new Uint8Array(0x40) }] };
      }
    }
    const proto = new SneakyFrames();
    proto.setZoneIntent(null);
    expect(proto.getWriteProfile()).toBe('stock');
    const { pipe } = await connected(proto);
    await expect(proto.upload(createMemoryMap(layout.memTotal), {})).rejects.toThrow(
      Uv5rMiniWriteRefusedError,
    );
    expect(pipe.writes).toHaveLength(0);
  });

  it('a table the codec refuses fails before the first frame', async () => {
    const { pipe, proto } = await connected();
    proto.setZoneIntent({ zones: [{ name: 'No members', slotIndexes: [] }] });
    await expect(proto.upload(createMemoryMap(layout.memTotal), {})).rejects.toThrow(/no members/);
    expect(pipe.writes).toHaveLength(0);
  });
});

describe('UV-5R Mini descriptor wiring for MM9PDY', () => {
  it('seeding from a stock projection keeps the stock plan, block for block', async () => {
    const { pipe, proto } = await connected();
    proto.setZoneIntent(zones(2));
    UV5R_MINI_DESCRIPTOR.hydration.seedProtocolForUpload!(proto, undefined, {});
    expect(proto.getZoneIntent()).toBeNull();
    expect(proto.getWriteProfile()).toBe('stock');
    await proto.upload(createMemoryMap(layout.memTotal), {});
    expect(pipe.wAddresses()).toEqual(STOCK_PLAN);
  });

  it('seeding from an MM9PDY projection sets the intent and the mm9pdy profile', () => {
    const proto = new Uv5rMiniProtocol();
    UV5R_MINI_DESCRIPTOR.hydration.seedProtocolForUpload!(proto, undefined, {
      writeUv5rMiniZones: true,
      zones: [{ wireName: 'Local', channelNumbers: [1, 3] }],
    });
    expect(proto.getZoneIntent()).toEqual({ zones: [{ name: 'Local', slotIndexes: [0, 2] }] });
    expect(proto.getWriteProfile()).toBe('mm9pdy');
  });

  it('the factory builds the Mini protocol', () => {
    expect(UV5R_MINI_DESCRIPTOR.protocolFactory()).toBeInstanceOf(Uv5rMiniProtocol);
  });

  it('plans Pre-write read, Upload, then Zone table only for an MM9PDY Write', () => {
    const plan = (organisation: object) =>
      UV5R_MINI_DESCRIPTOR.planStages!('write', {
        prepared: { channels: [], organisation },
      }).map((s) => s.label);
    expect(plan({})).toEqual(['Pre-write read', 'Upload']);
    expect(plan({ writeUv5rMiniZones: true, zones: [] })).toEqual([
      'Pre-write read',
      'Upload',
      UV5R_MINI_ZONE_TABLE_STAGE,
    ]);
    const stages = UV5R_MINI_DESCRIPTOR.planStages!('write', {
      prepared: {
        channels: [],
        organisation: {
          writeUv5rMiniZones: true,
          zones: [{ wireName: 'A', channelNumbers: [1] }],
        },
      },
    });
    expect(stages.at(-1)?.weight).toBe(4 * 0x40);
  });
});

describe('UV-5R Mini MM9PDY write verify', () => {
  async function verify(pipe: FakeRadio, intent: Uv5rMiniZoneTableInput | null) {
    const { proto } = await writeZones(intent, pipe);
    const session = { radio: proto, descriptor: UV5R_MINI_DESCRIPTOR } as unknown as RadioSession;
    const hooks = UV5R_MINI_DESCRIPTOR.writeVerify!;
    const captured = hooks.captureAfterUpload(session);
    expect(captured).toBeDefined();
    pipe.writes.length = 0;
    const result = await hooks.runVerify(session, captured!, {});
    return {
      result,
      reads: pipe.writes.filter((w) => w[0] === 0x52).map((w) => (w[1]! << 8) | w[2]!),
    };
  }

  it('reads 0xC000-0xCFFF back (64 frames) and matches the written table', async () => {
    const { result, reads } = await verify(new FakeRadio(), zones(3));
    expect(reads.filter((a) => a >= 0xc000)).toEqual(range(0xc000, 0x1000));
    expect(result.staging.mismatches).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.regions.find((r) => r.id === 'mm9pdy-zone-table')?.status).toBe('match');
  });

  it('reports a table frame that reads back different as a mismatch', async () => {
    const pipe = new FakeRadio();
    pipe.corruptAt = 0xc200;
    const { result } = await verify(pipe, zones(3));
    expect(result.ok).toBe(false);
    expect(result.staging.mismatches.map((m) => [m.kind, m.address, m.regionId])).toEqual([
      ['mismatch', 0xc200, 'mm9pdy-zone-table'],
    ]);
  });

  it('a stock Write reads nothing outside the clone', async () => {
    const { result, reads } = await verify(new FakeRadio(), null);
    expect(reads.every((a) => a < 0xc000)).toBe(true);
    expect(result.regions.some((r) => r.id === 'mm9pdy-zone-table')).toBe(false);
  });
});

describe('UV-5R Mini MM9PDY Backup and Restore of the zone table', () => {
  const TABLE_FRAMES = range(0xc000, 0x1000);

  it('Backup plan: the stock profile reads the clone only and refuses the table', async () => {
    const { pipe, proto } = await connected();
    expect(proto.getBackupRestoreProfile()).toBe('stock');
    await proto.download();
    expect(pipe.rAddresses()).toEqual(STOCK_PLAN);
    await expect(proto.downloadZoneTable()).rejects.toThrow(/MM9PDY target only/);
    expect(pipe.rAddresses()).toEqual(STOCK_PLAN);
  });

  it('Backup plan: the mm9pdy profile reads the clone, then 0xC000-0xCFC0 (64 frames), and nothing else', async () => {
    const radio = new FakeRadio();
    await writeZones(zones(5), radio);
    const { pipe, proto } = await connected(new Uv5rMiniProtocol(), radio);
    proto.setBackupRestoreProfile('mm9pdy');
    await proto.download();
    const sector = await proto.downloadZoneTable();
    expect(pipe.rAddresses()).toEqual([...STOCK_PLAN, ...TABLE_FRAMES]);
    expect(uv5rMiniZoneTableFrameAddresses()).toEqual(TABLE_FRAMES);
    expect(pipe.wAddresses()).toEqual([]);
    expect(sector).toEqual(radio.sector());
    const region = uv5rMiniZoneBackupRegion(sector).region;
    expect(region).toMatchObject({
      id: 'zones',
      address: 0xc000,
      byteLength: 0x1000,
      path: 'regions/zones.bin',
      restoreRole: 'restorable',
    });
    expect(region.label).toContain('5 zones');
    expect(uv5rMiniZoneBackupRegion(blankSector()).region.label).toContain('no table');
  });

  it('Restore plan, stock profile: the stock blocks only, the same with or without a table in the backup', async () => {
    for (const withZones of [false, true]) {
      const { pipe, proto } = await connected();
      const { manifest, image } = archiveFor(encodeUv5rMiniZoneTable(zones(3)).sector, {
        withZones,
      });
      await proto.restoreFromBackup(
        { manifest, image },
        { regionIds: ['mem-0', 'mem-1', 'mem-2'] },
      );
      expect(pipe.wAddresses()).toEqual(STOCK_PLAN);
    }
  });

  it('Restore plan, mm9pdy profile: the stock blocks, then the header at 0xC000, then the non-FF frames', async () => {
    const enc = encodeUv5rMiniZoneTable(zones(3));
    const { pipe, proto } = await connected();
    proto.setBackupRestoreProfile('mm9pdy');
    const { manifest, image } = archiveFor(enc.sector, { withZones: true });
    await proto.restoreFromBackup(
      { manifest, image },
      { regionIds: ['mem-0', 'mem-1', 'mem-2', 'zones'] },
    );
    const tableFrames = uv5rMiniZoneRestoreFrames(manifest, image).map((f) => f.address);
    expect(tableFrames[0]).toBe(0xc000);
    expect(tableFrames).toEqual([...tableFrames].sort((a, b) => a - b));
    expect(pipe.wAddresses()).toEqual([...STOCK_PLAN, ...tableFrames]);
    // The encoder writes only non-FF frames after the header too, so the plans agree frame for frame.
    expect(tableFrames).toEqual(enc.frames.map((f) => f.address).sort((a, b) => a - b));
    expect(pipe.sector()).toEqual(enc.sector);
    const decoded = decodeUv5rMiniZoneTable(pipe.sector());
    expect('reject' in decoded).toBe(false);
  });

  it('a table-only Restore writes the header first and no clone block, over an older table', async () => {
    const radio = new FakeRadio();
    await writeZones(zones(12), radio);
    const backup = encodeUv5rMiniZoneTable(zones(2));
    const { pipe, proto } = await connected(new Uv5rMiniProtocol(), radio);
    proto.setBackupRestoreProfile('mm9pdy');
    const { manifest, image } = archiveFor(backup.sector, { withZones: true });
    await proto.restoreFromBackup({ manifest, image }, { regionIds: ['zones'] });
    expect(pipe.wAddresses()[0]).toBe(0xc000);
    expect(pipe.wAddresses().every((a) => a >= 0xc000 && a <= 0xcfc0)).toBe(true);
    expect(radio.sector()).toEqual(backup.sector);
  });

  it('a backup with a blank table restores as "no table": the header alone, which erases an older table', async () => {
    const radio = new FakeRadio();
    await writeZones(zones(6), radio);
    const { pipe, proto } = await connected(new Uv5rMiniProtocol(), radio);
    proto.setBackupRestoreProfile('mm9pdy');
    const { manifest, image } = archiveFor(blankSector(), { withZones: true });
    await proto.restoreFromBackup({ manifest, image }, { regionIds: ['zones'] });
    expect(pipe.wAddresses()).toEqual([0xc000]);
    expect(radio.sector()).toEqual(blankSector());
    expect(decodeUv5rMiniZoneTable(radio.sector())).toEqual({ reject: 'blank header' });
  });

  it('a stock-profile Restore that names the table is refused before the first frame', async () => {
    const { pipe, proto } = await connected();
    proto.setBackupRestoreProfile('stock');
    const { manifest, image } = archiveFor(encodeUv5rMiniZoneTable(zones(3)).sector, {
      withZones: true,
    });
    for (const regionIds of [['zones'], ['mem-0', 'mem-1', 'mem-2', 'zones']]) {
      await expect(proto.restoreFromBackup({ manifest, image }, { regionIds })).rejects.toThrow(
        /MM9PDY target only/,
      );
      expect(pipe.writes).toHaveLength(0);
    }
  });

  it('a crafted table region at another address or size is refused before the first frame', async () => {
    const sector = encodeUv5rMiniZoneTable(zones(3)).sector;
    const bad: Partial<RadioBackupManifestV1['regions'][number]>[] = [
      { address: 0xd000 },
      { address: 0xb000 },
      { address: 0xe000 },
      { byteLength: 0x2000 },
      { byteLength: 0x40 },
      { restoreRole: 'inspect-only' },
    ];
    for (const patch of bad) {
      const { pipe, proto } = await connected();
      proto.setBackupRestoreProfile('mm9pdy');
      const { manifest, image } = archiveFor(sector, { withZones: true });
      const crafted = {
        ...manifest,
        regions: manifest.regions.map((r) => (r.id === 'zones' ? { ...r, ...patch } : r)),
      };
      await expect(
        proto.restoreFromBackup({ manifest: crafted, image }, { regionIds: ['zones'] }),
      ).rejects.toThrow(/zone table/);
      expect(pipe.writes).toHaveLength(0);
    }
  });

  it('every frame a table Restore can write stays inside 0xC000-0xCFC0, whatever the backup bytes', () => {
    const noisy = new Uint8Array(0x1000).map((_, i) => (i * 37) & 0xff);
    for (const sector of [noisy, blankSector(), encodeUv5rMiniZoneTable(zones(24)).sector]) {
      const { manifest, image } = archiveFor(sector, { withZones: true });
      for (const f of uv5rMiniZoneRestoreFrames(manifest, image)) {
        expect(f.address).toBeGreaterThanOrEqual(0xc000);
        expect(f.address).toBeLessThanOrEqual(0xcfc0);
        expect(f.bytes).toHaveLength(0x40);
        assertUv5rMiniWriteAllowed(f.address, 0x40, { profile: 'mm9pdy', operation: 'restore' });
      }
    }
  });

  it('the model check runs before any Restore frame: a radio that is not a Mini gets no W frame', async () => {
    const pipe = new FakeRadio(new TextEncoder().encode('NOTAMINI'));
    const { proto } = await connected(new Uv5rMiniProtocol(), pipe);
    proto.setBackupRestoreProfile('mm9pdy');
    const { manifest, image } = archiveFor(encodeUv5rMiniZoneTable(zones(3)).sector, {
      withZones: true,
    });
    await expect(
      proto.restoreFromBackup(
        { manifest, image },
        { regionIds: ['mem-0', 'mem-1', 'mem-2', 'zones'] },
      ),
    ).rejects.toThrow(RadioWrongIdentError);
    expect(pipe.wAddresses()).toEqual([]);
  });

  it('the interlock checks the whole Restore plan before the handshake', async () => {
    class BadRestore extends Uv5rMiniProtocol {
      protected override restoreExtraFrames() {
        return {
          stage: 'Zone table',
          frames: [
            { address: 0xc000, bytes: new Uint8Array(0x40) },
            { address: 0xd000, bytes: new Uint8Array(0x40) },
          ],
          regionIds: ['zones'],
        };
      }
    }
    const proto = new BadRestore();
    proto.setBackupRestoreProfile('mm9pdy');
    const { pipe } = await connected(proto);
    const { manifest, image } = archiveFor(blankSector(), { withZones: true });
    await expect(
      proto.restoreFromBackup({ manifest, image }, { regionIds: ['zones'] }),
    ).rejects.toThrow(Uv5rMiniWriteRefusedError);
    expect(pipe.writes).toHaveLength(0);
  });
});
