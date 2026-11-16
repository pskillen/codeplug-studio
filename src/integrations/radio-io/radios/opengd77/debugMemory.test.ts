import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { OPENGD77_BACKUP_FLASH_SPANS } from './backupRestoreRoles.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import {
  OPENGD77_CHANNEL_BANK_SIZE,
  OPENUV380_OFFSET,
  openUv380ChannelBankAbs,
} from './constants.ts';
import { buildOpenGd77DebugArchiveParts } from './debugCapture.ts';
import { openGd77CapturedImage, projectOpenGd77Memory } from './debugMemory.ts';
import { OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID } from './hydration.ts';
import { createOpenUv380Image, readAbs, writeAbs } from './memory.ts';
import { encodeZonesIntoImage } from './zoneCodec.ts';
import { makeOpenGd77FirmwareInfoPayload } from './__fixtures__/scriptedPipe.ts';

const channel = (
  slot: number,
  name: string,
  extra: Partial<RadioChannelDto> = {},
): RadioChannelDto => ({
  slotIndex: slot,
  empty: false,
  wireName: name,
  rxHz: 145_500_000,
  txHz: 145_500_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: null,
  bandwidth: 'FM',
  mode: 'analog',
  location: null,
  useLocation: false,
  ...extra,
});

function archiveOf(image = createOpenUv380Image()) {
  const p = buildOpenGd77DebugArchiveParts({
    modelId: OPENGD77_DM1701_MODEL_ID,
    capturedAt: '2026-01-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    firmwareInfoRaw: makeOpenGd77FirmwareInfoPayload(0x08, { features: 0 }),
    calibrationWorkingCopy: new Uint8Array(512),
    settingsGap: new Uint8Array(0x60),
    image,
    userDatabase: new Uint8Array(12),
  });
  return { manifest: p.manifest, regions: p.regions };
}
type Archive = ReturnType<typeof archiveOf>;

const without = (a: Archive, id: string): Archive => ({
  manifest: { ...a.manifest, regions: a.manifest.regions.filter((r) => r.id !== id) },
  regions: Object.fromEntries(Object.entries(a.regions).filter(([k]) => k !== id)),
});

/** The archive with one region cut to `length` bytes, manifest and stored bytes both. */
const truncated = (a: Archive, id: string, length: number): Archive => ({
  manifest: {
    ...a.manifest,
    regions: a.manifest.regions.map((r) => (r.id === id ? { ...r, byteLength: length } : r)),
  },
  regions: { ...a.regions, [id]: a.regions[id]!.subarray(0, length) },
});

function seeded() {
  const image = createOpenUv380Image();
  encodeChannelsIntoImage(
    image,
    [channel(1, 'SIMPLEX'), channel(130, 'BANK ONE', { powerPercent: 80 }), channel(1024, 'LAST')],
    { clearUnlisted: true },
  );
  encodeZonesIntoImage(image, [
    { wireName: 'LOCAL', channelNumbers: [1, 1, 130, 5, 2000] },
    { wireName: '', channelNumbers: [1024] },
  ]);
  return archiveOf(image);
}

const ok = (a: Archive, model = 'DM-1701') => {
  const p = projectOpenGd77Memory(a, model);
  if (p.status !== 'ok') throw new Error('unavailable');
  return p;
};

describe('openGd77CapturedImage', () => {
  it('accepts registered spans and covers byte-exactly', () => {
    const c = openGd77CapturedImage(seeded());
    expect(c.refused).toEqual([]);
    expect(c.covers(openUv380ChannelBankAbs(0), OPENGD77_CHANNEL_BANK_SIZE)).toBe(true);
    expect(c.covers(0x60c0, 4)).toBe(false);
  });

  it('refuses wrong address, length, path, bytes, duplicates and unknown ids', () => {
    const a = seeded();
    const id = OPENGD77_BACKUP_FLASH_SPANS[0]!.id;
    const bad = (mut: (r: Archive['manifest']['regions'][number]) => void, bytes?: Uint8Array) => {
      const manifest = {
        ...a.manifest,
        regions: a.manifest.regions.map((r) => {
          const copy = { ...r };
          if (r.id === id) mut(copy);
          return copy;
        }),
      };
      return openGd77CapturedImage({
        manifest,
        regions: bytes ? { ...a.regions, [id]: bytes } : a.regions,
      });
    };
    expect(bad((r) => (r.address += 1)).refused[0]!.id).toBe(id);
    expect(bad((r) => (r.byteLength += 1)).refused[0]!.id).toBe(id);
    expect(bad((r) => (r.path = 'regions/x.bin')).refused[0]!.id).toBe(id);
    expect(bad(() => {}, new Uint8Array(3)).refused[0]!.id).toBe(id);
    const dup = openGd77CapturedImage({
      manifest: { ...a.manifest, regions: [...a.manifest.regions, a.manifest.regions[0]!] },
      regions: a.regions,
    });
    expect(dup.refused.length).toBe(2);
    expect(dup.covers(0x3780, 4)).toBe(false);
    const unknown = openGd77CapturedImage({
      manifest: {
        ...a.manifest,
        regions: [...a.manifest.regions, { ...a.manifest.regions[0]!, id: 'flash-span-9' }],
      },
      regions: a.regions,
    });
    expect(unknown.refused.map((r) => r.id)).toContain('flash-span-9');
  });

  it('never fills a truncated tail with default bytes', () => {
    const a = seeded();
    const id = OPENGD77_BACKUP_FLASH_SPANS[0]!.id;
    const region = a.manifest.regions.find((r) => r.id === id)!;
    const cut = truncated(a, id, 0x3780 + 100 - region.address);
    expect(openGd77CapturedImage(cut).covers(0x3780, OPENGD77_CHANNEL_BANK_SIZE)).toBe(false);
    expect(ok(cut).channels.banks[0]!.status).toBe('not-captured');
  });
});

describe('projectOpenGd77Memory', () => {
  it('decodes channels with one-based slots across banks', () => {
    const p = ok(seeded());
    expect(p.channels.entries.map((e) => e.slot)).toEqual([1, 130, 1024]);
    expect(p.channels.banks.every((b) => b.status === 'captured')).toBe(true);
    expect(p.channels.capacity).toBe(1024);
    expect(p.channels.occupied).toBe(3);
    expect(p.channels.emptySlots).toBe(1021);
    expect(p.channels.notCapturedSlots).toBe(0);
  });

  it('shows a missing span as not captured, never zero channels', () => {
    const p = ok(without(seeded(), OPENGD77_BACKUP_FLASH_SPANS[3]!.id));
    expect(p.channels.banks.map((b) => b.status)).toEqual([
      'captured',
      ...Array(7).fill('not-captured'),
    ]);
    expect(p.channels.notCapturedSlots).toBe(7 * 128);
    expect(p.channels.entries.map((e) => e.slot)).toEqual([1]);
    expect(p.zones.status).toBe('captured');
    expect(p.zones.entries[0]!.members.map((m) => m.status)).toEqual([
      'resolved',
      'resolved',
      'not-captured',
      'absent',
      'out-of-range',
    ]);
  });

  it('shows nothing captured when only the User Database region exists', () => {
    const a = seeded();
    const only: Archive = {
      manifest: {
        ...a.manifest,
        regions: a.manifest.regions.filter((r) => r.id === 'user-database'),
      },
      regions: { 'user-database': a.regions['user-database']! },
    };
    const p = ok(only);
    expect(p.channels.notCapturedSlots).toBe(1024);
    expect(p.zones.status).toBe('not-captured');
    expect(p.zones.entries).toEqual([]);
  });

  it('distinguishes an occupied bit with an empty record', () => {
    const image = createOpenUv380Image();
    encodeChannelsIntoImage(image, [channel(1, 'A')], { clearUnlisted: true });
    const abs = openUv380ChannelBankAbs(0);
    const bank = readAbs(image, abs, OPENGD77_CHANNEL_BANK_SIZE).slice();
    bank[0] = bank[0]! | 0b100; // slot 3: bitmap set, record still 0xFF fill
    writeAbs(image, abs, bank);
    const p = ok(archiveOf(image));
    expect(p.channels.entries.map((e) => [e.slot, e.state])).toEqual([
      [1, 'decoded'],
      [3, 'occupied-empty-record'],
    ]);
  });

  it('decodes a hand-built record from documented offsets', () => {
    const image = createOpenUv380Image();
    const bank = new Uint8Array(OPENGD77_CHANNEL_BANK_SIZE);
    bank[0] = 1; // slot 1 occupied
    const rec = new Uint8Array(0x38);
    rec.set(new TextEncoder().encode('HANDMADE'), 0);
    rec.set([0x00, 0x00, 0x55, 0x14], 0x10); // 145.50000 MHz, BCD
    rec.set([0x00, 0x00, 0x55, 0x14], 0x14);
    rec[0x18] = 1; // digital
    rec[0x19] = 8; // power step 8
    rec[0x2c] = 3; // colour code
    bank.set(rec, 0x10);
    writeAbs(image, openUv380ChannelBankAbs(0), bank);
    const ch = ok(archiveOf(image)).channels.entries[0]!.channel;
    expect(ch.wireName).toBe('HANDMADE');
    expect(ch.mode).toBe('digital');
    expect(ch.colorCode).toBe(3);
    expect(ch.rxHz).toBe(145_500_000);
  });

  it('uses each model power ladder for the same wire step', () => {
    const image = createOpenUv380Image();
    const bank = new Uint8Array(OPENGD77_CHANNEL_BANK_SIZE).fill(0xff);
    bank.fill(0, 0, 0x10);
    bank[0] = 3;
    const rec = (name: string, power: number) => {
      const r = new Uint8Array(0x38);
      r.set(new TextEncoder().encode(name), 0);
      r.set([0x00, 0x00, 0x55, 0x14], 0x10);
      r[0x19] = power;
      return r;
    };
    bank.set(rec('S8', 8), 0x10);
    bank.set(rec('S0', 0), 0x10 + 0x38);
    writeAbs(image, openUv380ChannelBankAbs(0), bank);
    const a = archiveOf(image);
    const power = (id: string) =>
      ok(a, id)
        .channels.entries.filter((e) => e.slot <= 2)
        .map((e) => e.channel.powerPercent);
    expect(power(OPENGD77_DM1701_MODEL_ID)).toEqual([80, null]);
    expect(power(OPENGD77_MD9600_MODEL_ID)).toEqual([63, null]);
  });

  it('lists unnamed zones with members in order, duplicates kept', () => {
    const p = ok(seeded());
    expect(p.zones.capacity).toBe(68);
    expect(p.zones.entries.map((z) => [z.slot, z.name])).toEqual([
      [1, 'LOCAL'],
      [2, null],
    ]);
    expect(p.zones.entries[0]!.members.map((m) => m.channelNumber)).toEqual([1, 1, 130, 5, 2000]);
    expect(p.zones.entries[0]!.members.map((m) => m.status)).toEqual([
      'resolved',
      'resolved',
      'resolved',
      'absent',
      'out-of-range',
    ]);
    expect(p.zones.entries[1]!.members[0]).toMatchObject({
      status: 'resolved',
      channelName: 'LAST',
    });
  });

  it('needs the whole zone bank', () => {
    const a = seeded();
    const id = OPENGD77_BACKUP_FLASH_SPANS[1]!.id;
    const region = a.manifest.regions.find((r) => r.id === id)!;
    const cut = truncated(a, id, OPENUV380_OFFSET.zoneBank + 100 - region.address);
    expect(ok(cut).zones.status).toBe('not-captured');
  });

  it('is unavailable for an unknown model', () => {
    expect(projectOpenGd77Memory(seeded(), 'AT-D890UV').status).toBe('unavailable');
  });
});

describe('openGd77CapturedImage settings gap', () => {
  it('merges the 0x6060-0x60BF region so the settings struct is covered across span 0', () => {
    const a = archiveOf();
    a.regions['settings-gap']![0x5f] = 0x7e;
    const captured = openGd77CapturedImage(a);
    expect(captured.refused).toEqual([]);
    expect(captured.covers(0x604b, 0x74)).toBe(true);
    expect(captured.covers(0x60bf, 1)).toBe(true);
    expect(readAbs(captured.image, 0x60bf, 1)[0]).toBe(0x7e);
  });

  it('without the region (older archive) the struct is not covered', () => {
    const captured = openGd77CapturedImage(without(archiveOf(), 'settings-gap'));
    expect(captured.refused).toEqual([]);
    expect(captured.covers(0x604b, 0x74)).toBe(false);
  });

  it('refuses a wrong address, length, path, stored length or duplicate', () => {
    const a = archiveOf();
    const bad = (change: object) =>
      openGd77CapturedImage({
        manifest: {
          ...a.manifest,
          regions: a.manifest.regions.map((r) =>
            r.id === 'settings-gap' ? { ...r, ...change } : r,
          ),
        },
        regions: a.regions,
      });
    for (const change of [{ address: 0x6000 }, { byteLength: 0x40 }, { path: 'regions/x.bin' }]) {
      const c = bad(change);
      expect(c.refused.map((r) => r.id)).toEqual(['settings-gap']);
      expect(c.covers(0x6060, 1)).toBe(false);
    }
    const dup = openGd77CapturedImage({
      manifest: {
        ...a.manifest,
        regions: [...a.manifest.regions, a.manifest.regions.find((r) => r.id === 'settings-gap')!],
      },
      regions: a.regions,
    });
    expect(dup.refused.map((r) => r.id)).toEqual(['settings-gap', 'settings-gap']);
  });
});
