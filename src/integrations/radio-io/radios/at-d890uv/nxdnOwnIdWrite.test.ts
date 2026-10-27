import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import { AT_D890_NXDN_SETTINGS, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import {
  applyAtD890WriteImageToCache,
  atD890UploadBankIntentFromOrganisation,
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
} from './memory.ts';
import {
  AT_D890_NXDN_OWN_ID_ADDRESS,
  AT_D890_NXDN_SETTINGS_UNIT_BASE,
  assertAtD890NxdnOwnIdPatchPermitted,
  atD890NxdnOwnIdPatch,
  decodeAtD890NxdnOwnId,
  encodeAtD890NxdnOwnId,
} from './nxdnOwnId.ts';
import { AtD890uvProtocol } from './protocol.ts';
import { atD890BackupRestoreRole, atD890BackupSpanForAddress } from './backupRestoreRoles.ts';
import {
  assertAtD890NoReadAfterWrite,
  AtD890ScriptedPipe,
  collectAtD890ReadRequestAddresses,
  collectAtD890WriteDataAddresses,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890MinimalDownload,
  scriptAtD890UploadReadResponder,
  writePayloadAt,
} from './__fixtures__/scriptedPipe.ts';
import { allowLeakedD890MarkersInThisFile } from '../../../../test/leakedD890Marker.ts';

allowLeakedD890MarkersInThisFile();

const SERIAL = 'SN-TEST-NXID0001';
const UNIT = AT_D890_NXDN_SETTINGS_UNIT_BASE;
const inNxdnSettingsPair = (a: number) => a >= UNIT && a < UNIT + 0x8_0000;

describe('AT-D890 NXDN own ID codec (U5: 3-byte BCD)', () => {
  it('encodes the ID as big-endian BCD', () => {
    expect([...encodeAtD890NxdnOwnId(1234)]).toEqual([0x00, 0x12, 0x34]);
    expect([...encodeAtD890NxdnOwnId(1)]).toEqual([0x00, 0x00, 0x01]);
    expect([...encodeAtD890NxdnOwnId(65519)]).toEqual([0x06, 0x55, 0x19]);
  });

  it('refuses IDs the radio does not accept (U12: 1–65519)', () => {
    for (const bad of [0, -1, 65520, 65535, 1.5, Number.NaN]) {
      expect(() => encodeAtD890NxdnOwnId(bad)).toThrow(RadioProtocolError);
    }
  });

  it('decodes unset (all FF) and non-BCD bytes as no ID', () => {
    expect(decodeAtD890NxdnOwnId(Uint8Array.of(0x00, 0x12, 0x34))).toBe(1234);
    expect(decodeAtD890NxdnOwnId(Uint8Array.of(0xff, 0xff, 0xff))).toBeNull();
    expect(decodeAtD890NxdnOwnId(Uint8Array.of(0x00, 0x1a, 0x34))).toBeNull();
    expect(decodeAtD890NxdnOwnId(Uint8Array.of(0x00, 0x00, 0x00))).toBeNull();
  });
});

describe('AT-D890 NXDN own ID allow-list', () => {
  it('permits only the three OwnId bytes at 0x04B00000', () => {
    const patch = atD890NxdnOwnIdPatch(1234);
    expect(patch.address).toBe(0x04b0_0000);
    expect(AT_D890_NXDN_OWN_ID_ADDRESS).toBe(0x04b0_0000);
    expect(() => assertAtD890NxdnOwnIdPatchPermitted(patch)).not.toThrow();
  });

  it('refuses a patch anywhere else in the unit, of another length, or not BCD', () => {
    const patch = atD890NxdnOwnIdPatch(1234);
    // StationId at +0x03: never written.
    expect(() => assertAtD890NxdnOwnIdPatchPermitted({ ...patch, address: UNIT + 3 })).toThrow(
      RadioProtocolError,
    );
    expect(() =>
      assertAtD890NxdnOwnIdPatchPermitted({
        ...patch,
        bytes: Uint8Array.of(0, 0x12, 0x34, 0),
        mask: new Uint8Array(4).fill(0xff),
      }),
    ).toThrow(RadioProtocolError);
    expect(() =>
      assertAtD890NxdnOwnIdPatchPermitted({ ...patch, bytes: Uint8Array.of(0xff, 0xff, 0xff) }),
    ).toThrow(RadioProtocolError);
    expect(() => assertAtD890NxdnOwnIdPatchPermitted({ ...patch, fieldId: 'stationId' })).toThrow(
      RadioProtocolError,
    );
  });
});

function seedChannelZeroUpload(radio: AtD890uvProtocol): ReturnType<typeof cacheToMemoryMap> {
  const channelSet = new Uint8Array(0x200);
  setBitmapBit(channelSet, 0, true);
  const primary = new Uint8Array(0x40);
  primary.set(encodeBcdFrequencyHz(145_520_000), 0);
  radio.seedDownloadCache({
    blocks: new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
      [D890_MAP.ChannelSet, channelSet],
      [channelPrimaryAddress(0), primary],
      [channelSecondaryAddress(0), new Uint8Array(0x40)],
      [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
      // A Read put the NXDN settings block in the cache; it must never be re-sent from there.
      [AT_D890_NXDN_SETTINGS.Address, new Uint8Array(AT_D890_NXDN_SETTINGS.Bytes).fill(0x77)],
    ]),
  });
  const image = cacheToMemoryMap(radio.getDownloadCache()!);
  applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
  return image;
}

/**
 * The live NXDN settings unit: OwnId unset (the "NULL ID" radio), a station ID, factory defaults
 * at +0x2A / +0x30, the own name, an encryption key and a state message.
 */
function liveNxdnUnit(): Uint8Array {
  const unit = makeAtD890EraseUnitBuffer();
  unit.fill(0x00, 0x00, 0x50);
  unit.set([0xff, 0xff, 0xff], 0x00); // OwnId unset
  unit.set([0x00, 0x00, 0x99], 0x03); // StationId 99
  unit.set([0x44, 0x00, 0x38, 0x00], 0x0e); // TxAliasName "D8"
  unit[0x1e] = 0x19;
  unit[0x20] = 0x0a;
  unit[0x2a] = 2;
  unit[0x2c] = 1; // NxdnMoniRan: RX RAN check on
  unit[0x30] = 2;
  unit.fill(0x3c, 0x200, 0x261); // encryption keys
  unit.set([0x01, 0x00, 0x53, 0x00], 0x400); // state message 1
  return unit;
}

function uploadMemory(): Map<number, Uint8Array> {
  const unit348 = makeAtD890EraseUnitBuffer();
  unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
  unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
  return new Map<number, Uint8Array>([
    [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
    [0x100_0000, makeAtD890EraseUnitBuffer()],
    [0x348_0000, unit348],
    [UNIT, liveNxdnUnit()],
  ]);
}

const CHANNEL: RadioChannelDto = {
  slotIndex: 1,
  empty: false,
  wireName: '',
  rxHz: 145_520_000,
  txHz: 145_520_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: null,
  bandwidth: 'NFM',
};

async function uploadWith(organisation: RadioWriteOrganisation): Promise<AtD890ScriptedPipe> {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890ConnectWithNegotiation(pipe);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  scriptAtD890UploadReadResponder(pipe, uploadMemory());
  const image = seedChannelZeroUpload(radio);
  radio.setUploadBankIntent(atD890UploadBankIntentFromOrganisation(organisation, [CHANNEL]));
  enableAtD890AutoWriteAck(pipe);
  await radio.upload(image, {});
  return pipe;
}

function writeFrames(pipe: AtD890ScriptedPipe): string[] {
  return pipe.writes.filter((w) => w[0] === 0x57).map((w) => Buffer.from(w).toString('hex'));
}

describe('AtD890uvProtocol MM9PDY NXDN own ID (#1442)', () => {
  it('read-modify-writes the NXDN settings unit and changes only OwnId', async () => {
    const pipe = await uploadWith({ atD890SettingsTarget: 'mm9pdy', nxdnOwnId: 1234 });

    // The unit is read fresh before the first W.
    expect(collectAtD890ReadRequestAddresses(pipe).some(inNxdnSettingsPair)).toBe(true);
    assertAtD890NoReadAfterWrite(pipe.writes);

    const live = liveNxdnUnit();
    const first = writePayloadAt(pipe, UNIT)!;
    expect([...first.subarray(0, 3)]).toEqual([0x00, 0x12, 0x34]);
    expect([...first.subarray(3, 16)]).toEqual([...live.subarray(3, 16)]);
    // Every other non-erased block of the unit goes back as read.
    for (const off of [0x10, 0x20, 0x30, 0x40, 0x200, 0x210, 0x260, 0x400]) {
      expect([...writePayloadAt(pipe, UNIT + off)!]).toEqual([...live.subarray(off, off + 16)]);
    }
    // A half only, and nothing from the cached Read (0x77) reaches the wire.
    const written = collectAtD890WriteDataAddresses(pipe).filter(inNxdnSettingsPair);
    expect(written.every((a) => a < UNIT + 0x4_0000)).toBe(true);
    for (const a of written) {
      expect([...writePayloadAt(pipe, a)!].every((b) => b === 0x77)).toBe(false);
    }
  }, 30_000);

  it('leaves the unit alone on MM9PDY without an NXDN own ID (no read, no write)', async () => {
    const pipe = await uploadWith({ atD890SettingsTarget: 'mm9pdy' });
    expect(collectAtD890WriteDataAddresses(pipe).filter(inNxdnSettingsPair)).toEqual([]);
    expect(collectAtD890ReadRequestAddresses(pipe).filter(inNxdnSettingsPair)).toEqual([]);
  }, 30_000);

  it('keeps the stock target byte-identical even if the organisation carries an own ID', async () => {
    const without = await uploadWith({});
    const withOwnId = await uploadWith({ nxdnOwnId: 1234 });
    expect(writeFrames(withOwnId)).toEqual(writeFrames(without));
    expect(collectAtD890WriteDataAddresses(withOwnId).filter(inNxdnSettingsPair)).toEqual([]);
    expect(atD890UploadBankIntentFromOrganisation({ nxdnOwnId: 1234 }).nxdnOwnId).toBeUndefined();
  }, 30_000);

  it('refuses an out-of-range own ID before any frame', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, uploadMemory());
    const image = seedChannelZeroUpload(radio);
    radio.setUploadBankIntent(
      atD890UploadBankIntentFromOrganisation({ atD890SettingsTarget: 'mm9pdy', nxdnOwnId: 65520 }),
    );
    const framesBefore = pipe.writes.length;
    await expect(radio.upload(image, {})).rejects.toThrow(/NXDN own ID 65520/);
    expect(pipe.writes.length).toBe(framesBefore);
  });

  it('refuses to touch the NXDN settings unit without an own ID patch', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    // The private RMW core: a staged block in the unit without the own-ID patch is a staging bug.
    const rmw = (
      radio as unknown as {
        rmwStageAndTransmit(args: unknown): Promise<void>;
      }
    ).rmwStageAndTransmit.bind(radio);
    const framesBefore = pipe.writes.length;
    await expect(
      rmw({
        modelledChunks: [{ address: UNIT + 0x10, data: new Uint8Array(16) }],
        touchedUnits: [UNIT],
        settingsPatches: [],
        nxdnOwnIdPatches: [],
        ownedUnits: [],
        updateDownloadCache: false,
        opts: {},
      }),
    ).rejects.toThrow(/NXDN settings unit without an NXDN own ID/);
    expect(pipe.writes.length).toBe(framesBefore);
  });
});

describe('AtD890uvProtocol Read of the NXDN settings block (backup)', () => {
  it('reads the block into the cache and names it as an inspect-only backup span', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890MinimalDownload(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.download({});
    expect(collectAtD890ReadRequestAddresses(pipe)).toContain(AT_D890_NXDN_SETTINGS.Address);
    expect(radio.getDownloadCache()!.blocks.has(AT_D890_NXDN_SETTINGS.Address)).toBe(true);
    expect(atD890BackupSpanForAddress(AT_D890_NXDN_SETTINGS.Address)?.id).toBe('nxdn-settings');
    expect(atD890BackupRestoreRole(AT_D890_NXDN_SETTINGS.Address, 0x50)).toBe('inspect-only');
  });
});
