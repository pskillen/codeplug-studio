/**
 * UV-5R Mini Write fidelity (#1578): Read → Write with an unchanged library → Read gives the same bytes, and the
 * Write plan never reaches 0xF000-0xFFFF. Fakes only, synthetic image.
 */

import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';
import { uv17ProBackupMemSpans } from '../uv17pro-family/backupRestoreRoles.ts';
import {
  decodeChannelExtras,
  decodeChannelRecord,
  encodeChannelRecord,
  encodeChannelRecordOverPrior,
} from '../uv17pro-family/channelCodec.ts';
import { UV5R_MINI_LAYOUT as layout } from '../uv17pro-family/layout.ts';
import { FakeMiniRadio } from './__fixtures__/fakeMiniRadio.ts';
import {
  createRealisticPriorImage,
  encodeSyntheticRecord,
  SYNTHETIC_EMPTY_WITH_LEFTOVERS_SLOT,
  SYNTHETIC_RECORDS,
} from './__fixtures__/realisticPriorImage.ts';
import { Uv5rMiniProtocol } from './protocol.ts';

const REGIONS = layout.memStarts.map((start, i) => ({
  start,
  size: layout.memSizes[i]!,
  packed: layout.memStarts.slice(0, i).reduce((sum, _, j) => sum + layout.memSizes[j]!, 0),
}));

/** A fake radio whose flash holds `packed` at the clone addresses, and a synthetic pattern at 0xF000-0xFFFF. */
function radioHolding(packed: Uint8Array): FakeMiniRadio {
  const radio = new FakeMiniRadio();
  for (const r of REGIONS) radio.flash.set(packed.subarray(r.packed, r.packed + r.size), r.start);
  for (let a = 0xf000; a < 0x10000; a++) radio.flash[a] = (a * 7) & 0xff;
  return radio;
}

/** Every clone block address (`0x0000-0x803F`, `0x9000-0x903F`, `0xA000-0xA1BF`), in order. */
const CLONE_BLOCKS = REGIONS.flatMap((r) =>
  Array.from({ length: r.size / layout.blockSize }, (_, i) => r.start + i * layout.blockSize),
);

async function connected(radio: FakeMiniRadio) {
  const proto = new Uv5rMiniProtocol();
  await proto.connect(radio, { handshake: 'none' });
  return proto;
}

/** The library at the radio boundary, unchanged since the Read: the decoded live slots. */
function unchangedLibrary(proto: Uv5rMiniProtocol, image: ReturnType<typeof memoryMapFromBytes>) {
  return proto.decodeChannels(image).filter((c) => !c.empty);
}

describe('UV-5R Mini Write round trip (#1578)', () => {
  it('Read, Write with an unchanged library, Read: the upload payload equals the prior byte for byte', async () => {
    const prior = createRealisticPriorImage();
    const radio = radioHolding(prior);
    const calibrationBefore = radio.flash.slice(0xf000, 0x10000);
    const proto = await connected(radio);

    const read = await proto.download({});
    expect(read.bytes).toEqual(prior);
    const library = unchangedLibrary(proto, read);
    expect(library.map((c) => c.slotIndex)).toEqual(SYNTHETIC_RECORDS.map((r) => r.slot));

    const writeImage = proto.encodeChannels(read, library);
    expect(writeImage.bytes).toEqual(prior);

    // Wipe the clone regions after the Read, so what the radio holds afterwards can only come from the Write.
    for (const r of REGIONS) radio.flash.fill(0xff, r.start, r.start + r.size);
    radio.writes.length = 0;
    await proto.upload(writeImage, {});
    expect(new Set(radio.wAddresses())).toEqual(new Set(CLONE_BLOCKS));
    const payload = new Uint8Array(layout.memTotal).fill(0x00);
    for (const r of REGIONS) {
      payload.set(radio.flash.subarray(r.start, r.start + r.size), r.packed);
    }
    expect(payload).toEqual(prior);
    expect(radio.flash.slice(0xf000, 0x10000)).toEqual(calibrationBefore);

    const reread = await proto.download({});
    expect(reread.bytes).toEqual(prior);
  });

  it('a stock or MM9PDY Write never puts 0xF000-0xFFFF in its plan', async () => {
    for (const zones of [null, { zones: [{ name: 'Zone 1', slotIndexes: [0, 1, 998] }] }]) {
      const radio = radioHolding(createRealisticPriorImage());
      const proto = await connected(radio);
      proto.setZoneIntent(zones);
      const read = await proto.download({});
      radio.writes.length = 0;
      await proto.upload(proto.encodeChannels(read, unchangedLibrary(proto, read)), {});
      const addrs = radio.wAddresses();
      expect(addrs.length).toBeGreaterThan(0);
      expect(addrs.filter((a) => a >= 0xf000 && a < 0x10000)).toEqual([]);
      expect(Math.max(...addrs)).toBeLessThan(0xf000);
    }
  });
});

describe('UV-5R Mini Restore stays byte-identical', () => {
  it('Restore of a Backup of the prior, onto a radio that has since been written, reads back as the prior', async () => {
    const prior = createRealisticPriorImage();
    const spans = uv17ProBackupMemSpans(layout);
    const manifest: RadioBackupManifestV1 = {
      format: RADIO_BACKUP_FORMAT,
      version: RADIO_BACKUP_VERSION,
      capturedAt: '2026-11-13T12:00:00.000Z',
      capturedVia: 'web-serial',
      app: { buildEnv: 'test', buildVersion: '0' },
      radioModelId: layout.radioModelId,
      descriptorLabel: layout.protocolLabel,
      coverage: 'full-clone',
      imageByteLength: layout.memTotal,
      regions: spans.map((s) => ({
        id: s.id,
        label: s.id,
        address: s.packedOffset,
        byteLength: s.size,
        path: `regions/${s.id}.bin`,
        restoreRole: 'restorable' as const,
      })),
    };
    const changed = prior.slice();
    changed.fill(0xff, 0, layout.channelSpan);
    const radio = radioHolding(changed);
    const proto = await connected(radio);
    await proto.restoreFromBackup(
      { manifest, image: memoryMapFromBytes(prior) },
      { regionIds: spans.map((s) => s.id) },
    );
    expect(radio.wAddresses().every((a) => a < 0xf000)).toBe(true);
    expect((await proto.download({})).bytes).toEqual(prior);
  });
});

describe('UV-17Pro record merge over the prior (#1578)', () => {
  const priorRecord = encodeSyntheticRecord(SYNTHETIC_RECORDS[1]!); // slot 2: every extra byte non-default
  const decoded = decodeChannelRecord(layout, priorRecord, 2);

  it('decodes +0x0C..+0x13 and the spare bits', () => {
    const extras = decodeChannelExtras(priorRecord);
    expect(extras.signalCode).toBe(0x03);
    expect(extras.pttId).toBe(0x02);
    expect(extras.scramble).toBe(0);
    expect(extras.powerSpareBits).toBe(0);
    expect(extras.rxDtmf).toBe(0);
    expect(extras.busyLockout).toBe(true);
    expect(extras.fhss).toBe(false);
    expect(extras.flagSpareBits).toBe(0);
    expect([...extras.reserved]).toEqual([0x11, 0x22, 0x33, 0x44]);
    const other = decodeChannelExtras(encodeSyntheticRecord(SYNTHETIC_RECORDS[3]!));
    expect(other.scramble).toBe(1);
    expect(other.powerSpareBits).toBe(0);
    expect(other.rxDtmf).toBe(2);
    expect(other.fhss).toBe(true);
  });

  it('an unchanged channel is written as read', () => {
    for (const r of SYNTHETIC_RECORDS) {
      const raw = encodeSyntheticRecord(r);
      const dto = decodeChannelRecord(layout, raw, r.slot);
      expect(encodeChannelRecordOverPrior(layout, dto, raw)).toEqual(raw);
    }
  });

  /** The unmodelled bytes and bits today's encoding gives: scode 1, everything else 0. */
  function expectDefaultExtras(out: Uint8Array) {
    expect(out[12]).toBe(1);
    expect(out[13]).toBe(0);
    expect(out[14]! & 0xfc).toBe(0);
    expect(out[15]! & ~(0x40 | 0x04)).toBe(0);
    expect([...out.subarray(16, 20)]).toEqual([0, 0, 0, 0]);
  }

  it('an edited channel is encoded fresh, with the unmodelled fields at their defaults', () => {
    const renamed: RadioChannelDto = { ...decoded, wireName: 'RPT BRAVO' };
    const out = encodeChannelRecordOverPrior(layout, renamed, priorRecord);
    expect(out).toEqual(encodeChannelRecord(layout, renamed));
    expectDefaultExtras(out);
    expect(decodeChannelRecord(layout, out, 2).wireName).toBe('RPT BRAVO');

    const retuned: RadioChannelDto = { ...decoded, rxHz: 145_700_000, txHz: 145_100_000 };
    const out2 = encodeChannelRecordOverPrior(layout, retuned, priorRecord);
    expect(out2).toEqual(encodeChannelRecord(layout, retuned));
    expectDefaultExtras(out2);
  });

  it('a different channel shifted into a live slot does not inherit PTT ID, RX DTMF or the other extras', () => {
    // The slot's prior occupant has PTT ID, RX DTMF (sqmode), BCL, FHSS, scramble, a signal code and reserved
    // bytes set; a channel inserted earlier in the build pushes another channel into this slot.
    const occupant = encodeSyntheticRecord({
      ...SYNTHETIC_RECORDS[0]!,
      signalCode: 0x09,
      pttId: 0x03,
      power: 0x30,
      flags: 0x39,
      reserved: [0x12, 0x34, 0x56, 0x78],
    });
    const before = decodeChannelExtras(occupant);
    expect(before).toMatchObject({
      pttId: 3,
      rxDtmf: 3,
      busyLockout: true,
      fhss: true,
      scramble: 3,
    });

    const shifted = decodeChannelRecord(layout, encodeSyntheticRecord(SYNTHETIC_RECORDS[5]!), 1);
    const out = encodeChannelRecordOverPrior(layout, shifted, occupant);
    expect(out).toEqual(encodeChannelRecord(layout, shifted));
    expectDefaultExtras(out);
    expect(decodeChannelExtras(out)).toMatchObject({
      signalCode: 1,
      pttId: 0,
      rxDtmf: 0,
      busyLockout: false,
      fhss: false,
      scramble: 0,
    });
  });

  it('TX 00×4 (read as simplex) is rewritten when RX moves and TX stays', () => {
    const simplex = SYNTHETIC_RECORDS.find((r) => r.tx === 'zero')!;
    const raw = encodeSyntheticRecord(simplex);
    const dto = decodeChannelRecord(layout, raw, simplex.slot);
    const moved = { ...dto, rxHz: 433_600_000 };
    const out = encodeChannelRecordOverPrior(layout, moved, raw);
    expect(decodeChannelRecord(layout, out, simplex.slot)).toMatchObject({
      rxHz: 433_600_000,
      txHz: dto.txHz,
    });
  });

  it('a slot that was empty gets the plain encoding', () => {
    const empty = new Uint8Array(layout.channelSize).fill(0xff);
    const out = encodeChannelRecordOverPrior(layout, decoded, empty);
    expect(out[12]).toBe(1);
    expect(out[13]).toBe(0);
    expect(out.subarray(16, 20)).toEqual(new Uint8Array(4));
    expect(decodeChannelRecord(layout, out, 2)).toMatchObject({
      rxHz: decoded.rxHz,
      wireName: decoded.wireName,
    });
  });

  it('deleting a channel clears its slot; an already empty slot keeps its bytes', () => {
    const image = createRealisticPriorImage();
    const library = SYNTHETIC_RECORDS.filter((r) => r.slot !== 2).map((r) =>
      decodeChannelRecord(layout, encodeSyntheticRecord(r), r.slot),
    );
    const proto = new Uv5rMiniProtocol();
    const out = proto.encodeChannels(memoryMapFromBytes(image), library).bytes;
    expect(out.subarray(32, 64).every((b) => b === 0xff)).toBe(true);
    const leftovers = (SYNTHETIC_EMPTY_WITH_LEFTOVERS_SLOT - 1) * layout.channelSize;
    expect(out.subarray(leftovers, leftovers + 32)).toEqual(
      image.subarray(leftovers, leftovers + 32),
    );
  });
});
