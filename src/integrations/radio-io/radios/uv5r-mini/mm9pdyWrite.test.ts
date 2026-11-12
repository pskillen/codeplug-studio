/**
 * UV-5R Mini MM9PDY Write: the zone table frames after the stock blocks, the write-safety rules around them,
 * and write verify. Fakes only: the fake radio models the external flash (a W to a 4 KiB-aligned address
 * erases that sector first, as the radio's clone handler does).
 */

import { describe, expect, it } from 'vitest';
import type { BytePipe, ProgressUpdate, RadioSession } from '../../types.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';
import { PROGRAM_RW_ACK } from '../../kit/codecs/programRw.ts';
import { RadioWrongIdentError } from '../../kit/errors.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { uv17ProBackupMemSpans } from '../uv17pro-family/backupRestoreRoles.ts';
import { uv17ProCrypt } from '../uv17pro-family/crypt.ts';
import { UV5R_MINI_LAYOUT as layout } from '../uv17pro-family/layout.ts';
import { fakeMagicReply } from '../uv17pro-family/magicReplyTestKit.ts';
import type { Uv17ProExtraUploadFrames } from '../uv17pro-family/protocol.ts';
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

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Fake radio over a 64 KiB external flash. Acks every W; answers R from flash. */
class FakeRadio implements BytePipe {
  readonly writes: Uint8Array[] = [];
  readonly flash = new Uint8Array(0x10000).fill(0xff);
  private buf = new Uint8Array(0);
  /** Stop acking (and storing) after this many W frames: an interrupted Write. */
  ackLimit = Infinity;
  /** Corrupt the stored copy of the frame at this address (verify must catch it). */
  corruptAt: number | undefined;

  constructor(private readonly modelPrefix: Uint8Array | undefined = layout.modelReplyPrefix) {}

  private enqueue(chunk: Uint8Array): void {
    const next = new Uint8Array(this.buf.length + chunk.length);
    next.set(this.buf);
    next.set(chunk, this.buf.length);
    this.buf = next;
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (bytesEqual(data, layout.ident)) return this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
    for (const m of [...layout.magics.read, ...layout.magics.upload]) {
      if (bytesEqual(data, m.send))
        return this.enqueue(fakeMagicReply(m.send, m.responseLen, this.modelPrefix));
    }
    const addr = (data[1]! << 8) | data[2]!;
    if (data[0] === 0x57) {
      if (this.wAddresses().length > this.ackLimit) return;
      const plain = uv17ProCrypt(data.subarray(4, 4 + layout.blockSize), layout.defaultEncrsym);
      if (addr % 0x1000 === 0) this.flash.fill(0xff, addr, addr + 0x1000);
      this.flash.set(plain, addr);
      if (addr === this.corruptAt) this.flash[addr + 5] ^= 0x01;
      this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
      return;
    }
    if (data[0] === 0x52) {
      const plain = this.flash.slice(addr, addr + layout.blockSize);
      const frame = new Uint8Array(4 + layout.blockSize);
      frame.set([0x52, (addr >> 8) & 0xff, addr & 0xff, layout.blockSize]);
      frame.set(uv17ProCrypt(plain, layout.defaultEncrsym), 4);
      this.enqueue(frame);
    }
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.buf.length < n) throw new Error(`FakeRadio: needed ${n}, have ${this.buf.length}`);
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }

  async flush(): Promise<void> {
    this.buf = new Uint8Array(0);
  }

  async close(): Promise<void> {
    /* no-op */
  }

  wAddresses(): number[] {
    return this.writes.filter((w) => w[0] === 0x57).map((w) => (w[1]! << 8) | w[2]!);
  }

  sector(): Uint8Array {
    return this.flash.slice(MMZ1_BASE, MMZ1_END);
  }
}

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

  it('Restore on the mm9pdy profile writes only the stock spans and never the zone table', async () => {
    const { pipe, proto } = await connected();
    proto.setZoneIntent(zones(3));
    expect(proto.getWriteProfile()).toBe('mm9pdy');
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
      regions: uv17ProBackupMemSpans(layout).map((s) => ({
        id: s.id,
        label: s.id,
        address: s.packedOffset,
        byteLength: s.size,
        path: `regions/${s.id}.bin`,
        restoreRole: 'restorable' as const,
      })),
    };
    const image = createMemoryMap(layout.memTotal);
    await proto.restoreFromBackup({ manifest, image }, { regionIds: ['mem-0', 'mem-1', 'mem-2'] });
    expect(pipe.wAddresses()).toEqual(STOCK_PLAN);

    pipe.writes.length = 0;
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
