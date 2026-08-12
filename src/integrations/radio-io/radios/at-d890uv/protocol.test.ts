import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { listWriteChunks, cacheToMemoryMap, applyAtD890WriteImageToCache } from './memory.ts';
import { AtD890uvProtocol } from './protocol.ts';
import {
  AtD890ScriptedPipe,
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
} from './__fixtures__/scriptedPipe.ts';
import { labelForAtD890SentinelId } from './sentinelVerify.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR } from './constants.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import { channelPrimaryAddress, channelSecondaryAddress } from './memory.ts';
import { assembleAtD890WriteImage } from './hydration.ts';

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
  });

  it('sends END on disconnect after connect', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.disconnect();
    const endWrites = pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
    expect(endWrites).toHaveLength(1);
  });

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
    const channelSet = new Uint8Array(0x200);
    setBitmapBit(channelSet, 128, true);
    enqueueAtD890ReadReply(pipe, D890_MAP.ChannelSet, channelSet, NEGOTIATED_READ_BLOCK);
    const primary = new Uint8Array(0x40);
    primary.set(encodeBcdFrequencyHz(439_425_000), 0);
    const secondary = new Uint8Array(0x40);
    enqueueAtD890ReadReply(pipe, channelPrimaryAddress(128), primary, NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(pipe, channelSecondaryAddress(128), secondary, NEGOTIATED_READ_BLOCK);
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
  });

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
  });

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

  it('uploads from assembled write image without prior Read hydration cache', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory());

    // Match assembleAtD890WriteImage — 0xff base so inverted TalkgroupSet is empty.
    const image = assembleAtD890WriteImage([
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
    ]);

    enableAtD890AutoWriteAck(pipe);
    await radio.upload(image, {});

    expect(collectAtD890WriteDataAddresses(pipe).length).toBeGreaterThan(0);
    expect(radio.getDownloadCache()?.blocks.has(D890_MAP.LocalInfo)).toBe(false);
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
  });

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
  });

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
  });
});
