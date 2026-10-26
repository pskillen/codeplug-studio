import { describe, expect, it } from 'vitest';
import { RadioProtocolError, RadioWrongIdentError } from '../../kit/errors.ts';
import { D890_MAP } from './constants.ts';
import { listWriteChunks, cacheToMemoryMap, applyAtD890WriteImageToCache } from './memory.ts';
import { AtD890uvProtocol } from './protocol.ts';
import {
  AtD890ScriptedPipe,
  makeAtD890IdentFrame,
  scriptAtD890Connect,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890MinimalDownload,
  enqueueAtD890ReadReply,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890UploadReadResponder,
  collectAtD890WriteDataAddresses,
  indexOfFirstAtD890WriteFrame,
  writePayloadAt,
  enableAtD890AutoWriteAck,
  collectAtD890ReadRequestAddresses,
} from './__fixtures__/scriptedPipe.ts';
import { AT_D890_CHANNEL_LOCATION } from './constants.ts';
import { atD890UploadBankIntentFromOrganisation } from './memory.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { labelForAtD890SentinelId } from './sentinelVerify.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR } from './constants.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import { channelPrimaryAddress, channelSecondaryAddress } from './memory.ts';
import { encodeAtD890WriteImageFromDownloadCache } from './hydration.ts';
import { resolveAtD890SettingsPatches, type AtD890SettingsPatch } from './settingsFields.ts';

import { isAtD890EraseUnitBookkeepingAddress, listTouchedEraseUnits } from './eraseUnits.ts';

const NEGOTIATED_READ_BLOCK = 0xf0;
const TEST_SERIAL = 'SN-TEST-UPLOAD01';

function seedChannelZeroUpload(
  radio: AtD890uvProtocol,
  serial = TEST_SERIAL,
): ReturnType<typeof cacheToMemoryMap> {
  const channelSet = new Uint8Array(0x200);
  setBitmapBit(channelSet, 0, true);
  const primary = new Uint8Array(0x40);
  primary.set(encodeBcdFrequencyHz(145_520_000), 0);
  const secondary = new Uint8Array(0x40);

  radio.seedDownloadCache({
    blocks: new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(serial)],
      [D890_MAP.ChannelSet, channelSet],
      [channelPrimaryAddress(0), primary],
      [channelSecondaryAddress(0), secondary],
      [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
    ]),
  });

  const image = cacheToMemoryMap(radio.getDownloadCache()!);
  applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
  return image;
}

function channelUploadMemory(liveSerial = TEST_SERIAL): Map<number, Uint8Array> {
  const unit348 = makeAtD890EraseUnitBuffer();
  unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
  unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
  return new Map([
    [D890_MAP.LocalInfo, localInfoWithSerial(liveSerial)],
    [0x100_0000, makeAtD890EraseUnitBuffer()],
    [0x348_0000, unit348],
  ]);
}

/** Radio sector-marker pattern at +0x3fbf0 / +0x3fff0 — see eraseUnits.ts. */
function seedAtD890EraseUnitBookkeepingMarkers(unit: Uint8Array): void {
  unit.set(
    [
      0xff, 0xff, 0xff, 0xff, 0x22, 0x33, 0x44, 0x55, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff,
    ],
    0x3fbf0,
  );
  unit.set(
    [
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x55, 0x55, 0xaa,
      0xaa,
    ],
    0x3fff0,
  );
}

/** Upload memory with non-`0xff` bookkeeping blocks in every touched erase unit. */
function channelUploadMemoryWithBookkeepingMarkers(
  liveSerial = TEST_SERIAL,
): Map<number, Uint8Array> {
  const unit348 = makeAtD890EraseUnitBuffer();
  unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
  unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
  seedAtD890EraseUnitBookkeepingMarkers(unit348);
  const unit100 = makeAtD890EraseUnitBuffer();
  seedAtD890EraseUnitBookkeepingMarkers(unit100);
  return new Map([
    [D890_MAP.LocalInfo, localInfoWithSerial(liveSerial)],
    [0x100_0000, unit100],
    [0x348_0000, unit348],
  ]);
}

/** Absolute addresses of the 16-byte blocks of an erase unit that are not all 0xff and not markers. */
function nonFfBlockAddresses(unit: Uint8Array, include: (off: number) => boolean = () => true) {
  const out: number[] = [];
  for (let off = 0; off < unit.length; off += 16) {
    if (!include(off)) continue;
    if (unit.subarray(off, off + 16).every((b) => b === 0xff)) continue;
    if (isAtD890EraseUnitBookkeepingAddress(0x350_0000 + off)) continue;
    out.push(0x350_0000 + off);
  }
  return out;
}

describe('AtD890uvProtocol', () => {
  it('connects with PROGRAM→QX and ID890UV ident', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    const ident = await radio.connect(pipe);
    expect(ident.modelHints).toContain('AT-D890UV');
    expect(ident.firmwareHint).toBe('V100');
    expect(radio.getNegotiatedReadBlockSize()).toBe(NEGOTIATED_READ_BLOCK);
  });

  it('rejects a lone 0x00 PROGRAM ack and does not probe ident', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x00]));
    pipe.enqueue(makeAtD890IdentFrame());
    const radio = new AtD890uvProtocol();
    await expect(radio.connect(pipe)).rejects.toBeInstanceOf(RadioProtocolError);
    expect(pipe.writes.some((frame) => frame.length === 1 && frame[0] === 0x02)).toBe(false);
  });

  it('rejects a version other than V100 before any read or write', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe, 'V101');
    const radio = new AtD890uvProtocol();
    await expect(radio.connect(pipe)).rejects.toBeInstanceOf(RadioWrongIdentError);
    expect(pipe.writes.some((frame) => frame[0] === 0x52 || frame[0] === 0x57)).toBe(false);
  });

  it('rejects a model other than ID890UV before any read or write', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x51]));
    pipe.enqueue(new Uint8Array([0x58, 0x06]));
    pipe.enqueue(makeAtD890IdentFrame('V100', { model: 'D878UV2' }));
    const radio = new AtD890uvProtocol();
    await expect(radio.connect(pipe)).rejects.toBeInstanceOf(RadioWrongIdentError);
    expect(pipe.writes.some((frame) => frame[0] === 0x52 || frame[0] === 0x57)).toBe(false);
  });

  it('falls back to 16-byte reads when the radio rejects large blocks', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe, 0x10);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    expect(radio.getNegotiatedReadBlockSize()).toBe(0x10);
  });

  it('downloads sparse regions into cache', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890MinimalDownload(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const image = await radio.download({});
    expect(image.size).toBeGreaterThan(0);
    const cache = radio.getDownloadCache();
    expect(cache?.blocks.has(D890_MAP.LocalInfo)).toBe(true);
    expect(cache?.blocks.has(D890_MAP.ChannelSet)).toBe(true);
    expect(cache?.blocks.has(D890_MAP.OptionalSettingsMain)).toBe(true);
    expect(cache?.blocks.has(D890_MAP.OptionalSettingsExt)).toBe(true);
    expect(cache?.blocks.has(D890_MAP.AlarmBitmap)).toBe(true);
    expect(cache?.blocks.has(D890_MAP.AprsConfigMain)).toBe(true);
    expect(cache?.blocks.has(D890_MAP.AprsReceiveFilters)).toBe(true);
    expect(cache?.blocks.get(D890_MAP.AprsConfigMain)?.[0]).toBe(0x11);
  });

  it('uploads after seeding hydration with sparse erase-unit RMW', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());

    const image = seedChannelZeroUpload(radio);
    const modelled = listWriteChunks(radio.getDownloadCache()!, AT_D890_SAFE_SKIP_WRITE_ADDR);
    const touched = listTouchedEraseUnits(modelled.map((c) => c.address));
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const firstWrite = indexOfFirstAtD890WriteFrame(pipe);
    expect(firstWrite).toBeGreaterThan(0);
    const readsBeforeWrite = pipe.writes
      .slice(0, firstWrite)
      .filter((w) => w[0] === 0x52)
      .map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0);
    for (const unit of touched) {
      expect(readsBeforeWrite).toContain(unit);
    }

    const writtenAddrs = collectAtD890WriteDataAddresses(pipe);
    expect(writtenAddrs).not.toContain(AT_D890_SAFE_SKIP_WRITE_ADDR);
    expect(
      writtenAddrs.some((a) => a >= D890_MAP.LocalInfo && a < D890_MAP.LocalInfo + 0x100),
    ).toBe(false);
    expect(writePayloadAt(pipe, D890_MAP.AlarmBitmap)?.[0]).toBe(0xab);
    expect(writtenAddrs).not.toContain(D890_MAP.OptionalSettingsMain + 0x10);
  }, 20_000);

  it('patches only P1 and P2 when MM9PDY step keys are on and restages +0x200 from the radio', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const settings = makeAtD890EraseUnitBuffer();
    settings[0] = 0x11;
    settings[0x900] = 0x22;
    settings[0x1280] = 0x33;
    const block = new Uint8Array(16);
    for (let i = 0; i < block.length; i++) block[i] = 0x30 + i;
    settings.set(block, 0x10);
    const marker = new Uint8Array(16).fill(0x5a);
    settings.set(marker, 0x200);
    const memory = channelUploadMemory();
    memory.set(0x350_0000, settings);
    scriptAtD890UploadReadResponder(pipe, memory);
    const image = seedChannelZeroUpload(radio);
    radio.setUploadBankIntent(
      atD890UploadBankIntentFromOrganisation({ assignMm9pdyStepKeys: true }),
    );
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const keys = writePayloadAt(pipe, D890_MAP.OptionalSettingsMain + 0x10);
    expect(keys?.[0]).toBe(0x30);
    expect(keys?.[3]).toBe(14);
    expect(keys?.[4]).toBe(13);
    expect(keys?.[5]).toBe(0x35);
    expect(writePayloadAt(pipe, D890_MAP.OptionalSettingsMain + 0x200)).toEqual(marker);
  }, 20_000);

  it('applies a settings override on a stock target as a patch on the fresh read only', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const settings = makeAtD890EraseUnitBuffer();
    for (let i = 0; i < 0x160; i++) settings[i] = (i * 5 + 3) & 0xff;
    settings.set([0x41, 0x42, 0x43], 0x900);
    settings[0x1280] = 0x33;
    settings.fill(0x5a, 0x200, 0x210);
    const memory = channelUploadMemory();
    memory.set(0x350_0000, settings);
    scriptAtD890UploadReadResponder(pipe, memory);
    const image = seedChannelZeroUpload(radio);
    radio.setUploadBankIntent(
      atD890UploadBankIntentFromOrganisation({
        atD890SettingsTarget: 'stock',
        atD890SettingsOverrides: [{ fieldId: 'keyShortP1', value: 3 }],
      }),
    );
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const expected = settings.slice();
    expected[0x13] = 3;
    const zoneBytes = (off: number) => off >= 0x400 && off < 0x800;
    let compared = 0;
    for (const w of pipe.writes.filter((f) => f[0] === 0x57)) {
      const address = ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0;
      if (address < 0x350_0000 || address >= 0x354_0000) continue;
      const off = address - 0x350_0000;
      if (zoneBytes(off)) continue;
      expect([...w.subarray(6, 22)]).toEqual([...expected.subarray(off, off + 16)]);
      compared++;
    }
    expect(compared).toBeGreaterThan(10);
    // Every non-FF block of the unit outside the zone tables is restaged: the unit is erased on
    // the first frame, so a dropped block would be lost from flash.
    const transmitted = pipe.writes
      .filter((f) => f[0] === 0x57)
      .map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0)
      .filter((a) => a >= 0x350_0000 && a < 0x354_0000 && !zoneBytes(a - 0x350_0000));
    expect(transmitted).toEqual(nonFfBlockAddresses(expected, (off) => !zoneBytes(off)));
    expect(radio.takeUploadSettingsPatches()?.map((p) => p.fieldId)).toEqual(['keyShortP1']);
    expect(radio.takeUploadSettingsPatches()).toBeUndefined();
  });

  it('throws before any frame when the step-key switch and an override patch the same field', () => {
    expect(() =>
      atD890UploadBankIntentFromOrganisation({
        assignMm9pdyStepKeys: true,
        atD890SettingsTarget: 'mm9pdy',
        atD890SettingsOverrides: [{ fieldId: 'keyShortP2', value: 5 }],
      }),
    ).toThrow(RadioProtocolError);
  });

  it('cross-session verify after a step-key Write expects the patched bytes only (#1394)', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const settings = makeAtD890EraseUnitBuffer();
    settings[0] = 0x11;
    settings[0x900] = 0x22;
    settings[0x1280] = 0x33;
    settings[0x13] = 0x01;
    settings[0x14] = 0x02;
    const memory = channelUploadMemory();
    memory.set(0x350_0000, settings);
    scriptAtD890UploadReadResponder(pipe, memory);
    const image = seedChannelZeroUpload(radio);
    radio.setUploadBankIntent(
      atD890UploadBankIntentFromOrganisation({ assignMm9pdyStepKeys: true }),
    );
    enableAtD890AutoWriteAck(pipe);
    await radio.upload(image, {});
    const before = radio.takeUploadSentinelSnapshot()!;
    const patches = radio.takeUploadSettingsPatches()!;
    const written = writePayloadAt(pipe, D890_MAP.OptionalSettingsMain + 0x10)!;

    const after = settings.slice();
    after.set(written, 0x10);
    const reconnect = async (radioMemory: Map<number, Uint8Array>) => {
      await radio.disconnect();
      scriptAtD890ConnectWithNegotiation(pipe);
      await radio.connect(pipe);
      scriptAtD890UploadReadResponder(pipe, radioMemory);
    };

    const ok = channelUploadMemory();
    ok.set(0x350_0000, after);
    await reconnect(ok);
    expect(await radio.verifySentinelRegionsAgainst(before, { settingsPatches: patches })).toEqual({
      ok: true,
    });

    await reconnect(ok);
    const withoutPatches = await radio.verifySentinelRegionsAgainst(before);
    expect(withoutPatches.ok).toBe(false);

    const collateral = after.slice();
    collateral[0x05] = 0x77;
    const bad = channelUploadMemory();
    bad.set(0x350_0000, collateral);
    await reconnect(bad);
    const result = await radio.verifySentinelRegionsAgainst(before, { settingsPatches: patches });
    expect(result.ok).toBe(false);
  }, 20_000);

  describe('uploadSettingsPatches', () => {
    const patches = resolveAtD890SettingsPatches([{ fieldId: 'keyShortP1', value: 9 }], 'stock');

    function settingsUnit(): Uint8Array {
      const settings = makeAtD890EraseUnitBuffer();
      for (let i = 0; i < 0x160; i++) settings[i] = (i * 3 + 1) & 0xff;
      settings.set([0x41, 0x42], 0x900);
      settings[0x1280] = 0x33;
      settings.fill(0x5a, 0x200, 0x210);
      for (const off of [0x400, 0x600, 0x800, 0x1000, 0x1300, 0x2000, 0x10000, 0x3f000]) {
        settings.fill(0x60 + ((off >> 12) & 0xf), off, off + 16);
      }
      seedAtD890EraseUnitBookkeepingMarkers(settings);
      return settings;
    }

    async function connected(memory: Map<number, Uint8Array>) {
      const pipe = new AtD890ScriptedPipe();
      scriptAtD890ConnectWithNegotiation(pipe);
      const radio = new AtD890uvProtocol();
      await radio.connect(pipe);
      scriptAtD890UploadReadResponder(pipe, memory);
      enableAtD890AutoWriteAck(pipe);
      return { pipe, radio };
    }

    it('transmits only the settings erase unit, no markers, with just the patched bytes changed', async () => {
      const settings = settingsUnit();
      const { pipe, radio } = await connected(
        new Map([
          [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
          [0x350_0000, settings],
        ]),
      );

      await radio.uploadSettingsPatches(patches, {});

      const frames = pipe.writes.filter((w) => w[0] === 0x57);
      expect(frames.length).toBeGreaterThan(10);
      const expected = settings.slice();
      expected[0x13] = 9;
      // Every non-FF block is restaged, in order, and nothing else: the unit is erased on the
      // first frame, so a dropped block would be lost from flash.
      expect(
        frames.map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0),
      ).toEqual(nonFfBlockAddresses(expected));
      for (const w of frames) {
        const address = ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0;
        expect(address).toBeGreaterThanOrEqual(0x350_0000);
        expect(address).toBeLessThan(0x354_0000);
        expect(isAtD890EraseUnitBookkeepingAddress(address)).toBe(false);
        const off = address - 0x350_0000;
        expect([...w.subarray(6, 22)]).toEqual([...expected.subarray(off, off + 16)]);
      }
      const reads = collectAtD890ReadRequestAddresses(pipe);
      expect(reads.some((a) => a >= 0x100_0000 && a < 0x348_0000)).toBe(false);
      expect(radio.takeUploadSettingsPatches()?.map((p) => p.fieldId)).toEqual(['keyShortP1']);
      expect(radio.takeUploadSentinelSnapshot()).toBeDefined();
      expect(radio.takeUploadStagingSnapshot()?.chunks.length).toBe(frames.length);
    }, 20_000);

    it('refuses an all-0xff settings unit before any frame and sends no END', async () => {
      const { pipe, radio } = await connected(
        new Map([
          [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
          [0x350_0000, makeAtD890EraseUnitBuffer()],
        ]),
      );

      await expect(radio.uploadSettingsPatches(patches, {})).rejects.toBeInstanceOf(
        RadioProtocolError,
      );
      expect(indexOfFirstAtD890WriteFrame(pipe)).toBe(-1);
      await radio.disconnect();
      expect(pipe.writes.some((w) => new TextDecoder().decode(w) === 'END')).toBe(false);
      expect(radio.takeUploadSettingsPatches()).toBeUndefined();
    }, 20_000);

    it('refuses an empty patch list', async () => {
      const { radio } = await connected(new Map());
      await expect(radio.uploadSettingsPatches([], {})).rejects.toBeInstanceOf(RadioProtocolError);
    });

    describe('transmit-layer allow-list', () => {
      const raw = (address: number): AtD890SettingsPatch => ({
        fieldId: 'raw',
        address,
        bytes: Uint8Array.of(0xaa),
        mask: Uint8Array.of(0xff),
      });
      const refused: ReadonlyArray<readonly [string, number]> = [
        ['Zone A table', 0x350_0400],
        ['MM9PDY store (+0x200)', 0x350_0200],
        ['APRS', 0x350_1000],
        ['never-patch radio state (+0x15)', 0x350_0015],
        ['+0x160', 0x350_0160],
        ['flash marker', 0x353_fbf0],
        ['LocalInfo', D890_MAP.LocalInfo],
      ];

      for (const [name, address] of refused) {
        it(`uploadSettingsPatches refuses a raw patch at ${name} before any frame`, async () => {
          const { pipe, radio } = await connected(
            new Map([
              [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
              [0x350_0000, settingsUnit()],
            ]),
          );
          const before = collectAtD890ReadRequestAddresses(pipe).length;
          await expect(radio.uploadSettingsPatches([raw(address)], {})).rejects.toBeInstanceOf(
            RadioProtocolError,
          );
          expect(indexOfFirstAtD890WriteFrame(pipe)).toBe(-1);
          expect(collectAtD890ReadRequestAddresses(pipe).length).toBe(before);
        });
      }

      it('refuses a patch whose mask length differs from its bytes', async () => {
        const { pipe, radio } = await connected(new Map());
        await expect(
          radio.uploadSettingsPatches(
            [{ ...raw(0x350_0013), mask: new Uint8Array(2).fill(0xff) }],
            {},
          ),
        ).rejects.toBeInstanceOf(RadioProtocolError);
        expect(indexOfFirstAtD890WriteFrame(pipe)).toBe(-1);
      });

      it('upload() refuses a raw patch in the bank intent before any frame', async () => {
        const pipe = new AtD890ScriptedPipe();
        scriptAtD890ConnectWithNegotiation(pipe);
        const radio = new AtD890uvProtocol();
        await radio.connect(pipe);
        scriptAtD890UploadReadResponder(pipe, channelUploadMemory());
        const image = seedChannelZeroUpload(radio);
        radio.setUploadBankIntent({
          ...atD890UploadBankIntentFromOrganisation({}),
          settingsPatches: [raw(0x350_0015)],
        });
        enableAtD890AutoWriteAck(pipe);
        await expect(radio.upload(image, {})).rejects.toBeInstanceOf(RadioProtocolError);
        expect(indexOfFirstAtD890WriteFrame(pipe)).toBe(-1);
      });

      it('a custom registry cannot resolve a spec outside the allow-list', () => {
        const spec = {
          id: 'bad',
          address: 0x350_0400,
          length: 1,
          targets: ['stock'] as const,
          advanced: false,
          encode: () => Uint8Array.of(1),
          decode: () => 1,
        };
        expect(() =>
          resolveAtD890SettingsPatches(
            [{ fieldId: 'bad', value: 1 }],
            'stock',
            new Map([['bad', spec]]),
          ),
        ).toThrow(RadioProtocolError);
      });
    });

    describe('download cache', () => {
      it('a settings-only Write on a session with no download leaves the cache empty', async () => {
        const { radio } = await connected(
          new Map([
            [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
            [0x350_0000, settingsUnit()],
          ]),
        );
        expect(radio.getDownloadCache()?.blocks.size).toBe(0);
        await radio.uploadSettingsPatches(patches, {});
        expect(radio.getDownloadCache()?.blocks.size).toBe(0);
      }, 20_000);

      it('a later codeplug upload still hits the empty-cache guard', async () => {
        const memory = channelUploadMemory();
        memory.set(0x350_0000, settingsUnit());
        const pipe = new AtD890ScriptedPipe();
        scriptAtD890ConnectWithNegotiation(pipe);
        const radio = new AtD890uvProtocol();
        await radio.connect(pipe);
        scriptAtD890UploadReadResponder(pipe, memory);
        enableAtD890AutoWriteAck(pipe);
        await radio.uploadSettingsPatches(patches, {});
        const writesBefore = pipe.writes.filter((w) => w[0] === 0x57).length;
        const image = seedChannelZeroUpload(radio);
        radio.getDownloadCache()!.blocks.clear();
        await expect(radio.upload(image, {})).rejects.toThrow(/in-session download cache/);
        expect(pipe.writes.filter((w) => w[0] === 0x57).length).toBe(writesBefore);
      }, 20_000);

      it('a settings-only Write keeps a populated cache in step with what it transmitted', async () => {
        const memory = channelUploadMemory();
        const settings = settingsUnit();
        memory.set(0x350_0000, settings);
        const pipe = new AtD890ScriptedPipe();
        scriptAtD890ConnectWithNegotiation(pipe);
        const radio = new AtD890uvProtocol();
        await radio.connect(pipe);
        scriptAtD890UploadReadResponder(pipe, memory);
        enableAtD890AutoWriteAck(pipe);
        seedChannelZeroUpload(radio);
        const size = radio.getDownloadCache()!.blocks.size;
        expect(size).toBeGreaterThan(0);
        await radio.uploadSettingsPatches(patches, {});
        expect(radio.getDownloadCache()!.blocks.get(0x350_0010)?.[3]).toBe(9);
      }, 20_000);
    });

    it('readSettingsSnapshot reads only the four settings spans and reports the ident band', async () => {
      const settings = settingsUnit();
      const { pipe, radio } = await connected(
        new Map([
          [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
          [0x350_0000, settings],
          [D890_MAP.MasterIdData, new Uint8Array(D890_MAP.MasterIdLength).fill(0x07)],
        ]),
      );
      const before = collectAtD890ReadRequestAddresses(pipe).length;

      const snap = await radio.readSettingsSnapshot();

      expect(snap.main).toEqual(settings.subarray(0, 0x200));
      expect(snap.ext).toEqual(settings.subarray(0x900, 0x960));
      expect(snap.masterId).toEqual(new Uint8Array(0x40).fill(0x07));
      expect(snap.localInfo.length).toBe(D890_MAP.LocalInfoLength);
      expect(snap.bandCode).toBe(0x03);
      const reads = collectAtD890ReadRequestAddresses(pipe).slice(before);
      for (const a of reads) {
        const inSpan =
          (a >= D890_MAP.LocalInfo && a < D890_MAP.LocalInfo + 0x100) ||
          (a >= 0x350_0000 && a < 0x350_0200) ||
          (a >= 0x350_0900 && a < 0x350_0960) ||
          (a >= D890_MAP.MasterIdData && a < D890_MAP.MasterIdData + 0x40);
        expect(inSpan).toBe(true);
      }
    });
  });

  it('never transmits the per-unit flash bookkeeping blocks', async () => {
    // E7: `+0x3fbf0` and `+0x3fff0` are radio-managed sector metadata, confirmed on
    // hardware — the marker changed on flash without Studio ever writing it. Not the
    // cause of the D890 commit issue, but writing it back was always wrong regardless.
    // See tmp/anytone-airband/d890-write-commit-divergence.md §4.
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemoryWithBookkeepingMarkers());

    const image = seedChannelZeroUpload(radio);
    enableAtD890AutoWriteAck(pipe);
    await radio.upload(image, {});

    const written = collectAtD890WriteDataAddresses(pipe);
    const bookkeeping = written.filter((a) => isAtD890EraseUnitBookkeepingAddress(a));
    expect(bookkeeping).toEqual([]);
  }, 20_000);

  it('sends END on disconnect after connect', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.disconnect();
    const endWrites = pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
    expect(endWrites).toHaveLength(1);
  }, 20_000);

  it('sends END on disconnect after download', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890MinimalDownload(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.download({});
    await radio.disconnect();
    const endWrites = pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
    expect(endWrites).toHaveLength(1);
  });

  it('reads channel bank 1 when ChannelSet bit 128 is set (16-byte cache keys)', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.LocalInfo,
      new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.OptionalSettingsMain,
      new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.OptionalSettingsExt,
      new Uint8Array(D890_MAP.OptionalSettingsExtLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.OptionalSettingsAprs,
      new Uint8Array(D890_MAP.OptionalSettingsAprsLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.SettingsStore,
      new Uint8Array(D890_MAP.SettingsStoreLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.DtmfList,
      new Uint8Array(D890_MAP.DtmfListLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.OptionalSettingsExtTail,
      new Uint8Array(D890_MAP.OptionalSettingsExtTailLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AlarmBitmap,
      new Uint8Array(D890_MAP.AlarmBitmapLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AlarmData,
      new Uint8Array(D890_MAP.AlarmDataLength).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AprsConfigMain,
      new Uint8Array(D890_MAP.AprsConfigMainLength).fill(0x11),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AprsReceiveFilters,
      new Uint8Array(D890_MAP.AprsReceiveFiltersLength).fill(0x22),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AprsTextTail,
      new Uint8Array(D890_MAP.AprsTextTailLength).fill(0x33),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.GpsInfoTail,
      new Uint8Array(D890_MAP.GpsInfoTailLength).fill(0x33),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.GpsZoneSwitch,
      new Uint8Array(D890_MAP.GpsZoneSwitchLength).fill(0x33),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AprsBeaconNames,
      new Uint8Array(D890_MAP.AprsBeaconNamesLength).fill(0x33),
      NEGOTIATED_READ_BLOCK,
    );
    const channelSet = new Uint8Array(0x200);
    setBitmapBit(channelSet, 128, true);
    enqueueAtD890ReadReply(pipe, D890_MAP.ChannelSet, channelSet, NEGOTIATED_READ_BLOCK);
    const primary = new Uint8Array(0x40);
    primary.set(encodeBcdFrequencyHz(439_425_000), 0);
    const secondary = new Uint8Array(0x40);
    enqueueAtD890ReadReply(pipe, channelPrimaryAddress(128), primary, NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(pipe, channelSecondaryAddress(128), secondary, NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.VfoChannels,
      new Uint8Array(D890_MAP.VfoChannelsLength).fill(0x44),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(pipe, D890_MAP.ZoneSet, new Uint8Array(0x20), NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(pipe, D890_MAP.ZoneHide, new Uint8Array(0x20), NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.ZoneAChannel,
      new Uint8Array(0x200),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.ZoneBChannel,
      new Uint8Array(0x200),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(pipe, D890_MAP.ScanListSet, new Uint8Array(0x20), NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.TalkgroupSet,
      new Uint8Array(0x4f0).fill(0xff),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.ReceiveGroupSet,
      new Uint8Array(0x20),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(pipe, D890_MAP.RadioIdSet, new Uint8Array(0x20), NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.MasterIdData,
      new Uint8Array(0x40),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AmAirSet,
      new Uint8Array(D890_MAP.AmAirSetLength),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AmAirVfo,
      new Uint8Array(D890_MAP.AmAirVfoLength),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AmZoneSet,
      new Uint8Array(D890_MAP.AmZoneSetLength),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AmZoneAChannel,
      new Uint8Array(D890_MAP.AmZoneAChannelLength),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.AmZoneScan,
      new Uint8Array(D890_MAP.AmZoneScanLength),
      NEGOTIATED_READ_BLOCK,
    );

    await radio.download({});
    const cache = radio.getDownloadCache()!;
    expect(cache.blocks.has(channelPrimaryAddress(128))).toBe(true);
    expect(channelPrimaryAddress(128)).toBe(0x108_0000);
  });

  it('does not send END after failed upload abandons program mode', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());

    const image = seedChannelZeroUpload(radio);
    let ackedWrites = 0;
    const baseWrite = pipe.write.bind(pipe);
    pipe.write = async (data: Uint8Array) => {
      await baseWrite(data);
      if (data[0] === 0x57 && ackedWrites++ === 0) {
        pipe.enqueue(new Uint8Array([0x06]));
      }
    };

    await expect(radio.upload(image, {})).rejects.toThrow();
    await radio.disconnect();

    const endWrites = pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
    expect(endWrites).toHaveLength(0);
  }, 20_000);

  it('refuses upload when sentinel regions read all 0xff before any write frames', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);

    const image = seedChannelZeroUpload(radio);
    const memory = channelUploadMemory();
    memory.set(
      D890_MAP.OptionalSettingsMain,
      new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0xff),
    );
    scriptAtD890UploadReadResponder(pipe, memory);

    await expect(radio.upload(image, {})).rejects.toThrow(/OptionalSettingsMain reads erased/);

    expect(collectAtD890WriteDataAddresses(pipe)).toHaveLength(0);
  }, 20_000);

  it('refuses upload when LocalInfo serial reads erased', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const erasedLocal = new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff);
    const memory = channelUploadMemory();
    memory.set(D890_MAP.LocalInfo, erasedLocal);
    scriptAtD890UploadReadResponder(pipe, memory);

    const image = seedChannelZeroUpload(radio);

    await expect(radio.upload(image, {})).rejects.toThrow(/LocalInfo reads erased/);
    expect(collectAtD890WriteDataAddresses(pipe)).toHaveLength(0);
  });

  it('uploads from an encode onto the in-session download cache', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());

    seedChannelZeroUpload(radio);
    const encoded = encodeAtD890WriteImageFromDownloadCache(
      radio.getDownloadCache(),
      [
        {
          slotIndex: 1,
          empty: false,
          wireName: 'CH0',
          rxHz: 145_520_000,
          txHz: 145_520_000,
          rxTone: { kind: 'none' },
          txTone: { kind: 'none' },
          powerPercent: 100,
          bandwidth: 'FM',
          mode: 'analog',
        },
      ],
      {
        zones: [{ wireName: 'Z1', channelNumbers: [1] }],
      },
    );

    enableAtD890AutoWriteAck(pipe);
    await radio.upload(encoded, {});

    expect(collectAtD890WriteDataAddresses(pipe).length).toBeGreaterThan(0);
  }, 20_000);

  it('refuses upload when the in-session download cache is empty', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());
    const image = seedChannelZeroUpload(radio);
    radio.getDownloadCache()!.blocks.clear();
    await expect(radio.upload(image, {})).rejects.toThrow(/in-session download cache/);
    expect(collectAtD890WriteDataAddresses(pipe)).toHaveLength(0);
  });

  it('exposes pre-Write sentinel snapshot after upload', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());
    enableAtD890AutoWriteAck(pipe);

    const image = seedChannelZeroUpload(radio);
    await radio.upload(image, {});

    const snap = radio.takeUploadSentinelSnapshot();
    expect(snap?.get('OptionalSettingsMain')?.[0]).toBe(0x00);
    expect(radio.takeUploadSentinelSnapshot()).toBeUndefined();
  }, 20_000);

  it('verifySentinelRegionsAgainst passes when post-commit reads match', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());
    enableAtD890AutoWriteAck(pipe);

    const image = seedChannelZeroUpload(radio);
    await radio.upload(image, {});
    const before = radio.takeUploadSentinelSnapshot()!;

    await radio.disconnect();
    scriptAtD890ConnectWithNegotiation(pipe);
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());

    const result = await radio.verifySentinelRegionsAgainst(before);
    expect(result).toEqual({ ok: true });
  }, 20_000);

  it('verifySentinelRegionsAgainst names a mismatched region', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());
    enableAtD890AutoWriteAck(pipe);

    const image = seedChannelZeroUpload(radio);
    await radio.upload(image, {});
    const before = radio.takeUploadSentinelSnapshot()!;

    await radio.disconnect();
    scriptAtD890ConnectWithNegotiation(pipe);
    await radio.connect(pipe);
    const mismatched = channelUploadMemory();
    const main = new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0xff);
    main[0] = 0x99;
    mismatched.set(D890_MAP.OptionalSettingsMain, main);
    scriptAtD890UploadReadResponder(pipe, mismatched);

    const result = await radio.verifySentinelRegionsAgainst(before);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.mismatches).toEqual([
        {
          id: 'OptionalSettingsMain',
          label: labelForAtD890SentinelId('OptionalSettingsMain'),
        },
      ]);
    }
  }, 20_000);
});

describe('AtD890uvProtocol MM9PDY channel location table (#1383)', () => {
  function locationUnitWithFactoryPattern(): Uint8Array {
    const unit = makeAtD890EraseUnitBuffer();
    unit.fill(0x55, 0, 0x10);
    unit.set([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09], 0x1000);
    unit.fill(0xab, 0x2000, 0x2010);
    return unit;
  }

  function located(): RadioChannelDto {
    return {
      slotIndex: 1,
      empty: false,
      wireName: '',
      rxHz: 145_520_000,
      txHz: 145_520_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: null,
      bandwidth: 'NFM',
      useLocation: true,
      location: { lat: 55.852056, lon: -4.259463 },
    };
  }

  it('writes the header and every slot, owns the unit and never carries over the test pattern', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const memory = channelUploadMemory();
    memory.set(AT_D890_CHANNEL_LOCATION.BASE_ADDRESS, locationUnitWithFactoryPattern());
    scriptAtD890UploadReadResponder(pipe, memory);
    const image = seedChannelZeroUpload(radio);
    radio.setUploadBankIntent(
      atD890UploadBankIntentFromOrganisation(
        { writeChannelLocationTable: true, channelDistanceUnit: 'mi' },
        [located()],
      ),
    );
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const base = AT_D890_CHANNEL_LOCATION.BASE_ADDRESS;
    const inPair = collectAtD890WriteDataAddresses(pipe).filter(
      (a) => a >= base && a < AT_D890_CHANNEL_LOCATION.PAIR_B_ADDRESS + 0x4_0000,
    );
    expect(inPair).toEqual([base, base + 0x10, base + 0x20]);
    const header = writePayloadAt(pipe, base)!;
    expect(new TextDecoder().decode(header.subarray(0, 4))).toBe('LOC1');
    expect(header[6]).toBe(1);
    expect(header[8]).toBe(1);
    const entry = writePayloadAt(pipe, base + 0x20)!;
    expect(entry[14]).toBe(1);
    expect(entry.subarray(8, 12)).toEqual(encodeBcdFrequencyHz(145_520_000));
  }, 20_000);

  it('leaves the pair alone on a stock intent, even if the cache holds stale table blocks', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const memory = channelUploadMemory();
    memory.set(AT_D890_CHANNEL_LOCATION.BASE_ADDRESS, locationUnitWithFactoryPattern());
    scriptAtD890UploadReadResponder(pipe, memory);
    const image = seedChannelZeroUpload(radio);
    radio
      .getDownloadCache()!
      .blocks.set(AT_D890_CHANNEL_LOCATION.BASE_ADDRESS, new Uint8Array(16).fill(0x11));
    radio.setUploadBankIntent(atD890UploadBankIntentFromOrganisation({}, [located()]));
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const base = AT_D890_CHANNEL_LOCATION.BASE_ADDRESS;
    const touches = (a: number) =>
      a >= base && a < AT_D890_CHANNEL_LOCATION.PAIR_B_ADDRESS + 0x4_0000;
    expect(collectAtD890WriteDataAddresses(pipe).filter(touches)).toEqual([]);
    expect(collectAtD890ReadRequestAddresses(pipe).filter(touches)).toEqual([]);
  }, 20_000);
});
