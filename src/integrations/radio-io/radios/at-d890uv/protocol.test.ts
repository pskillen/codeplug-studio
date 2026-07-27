import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
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
  collectAtD890ReadRequestAddresses,
  collectAtD890WriteDataAddresses,
  indexOfFirstAtD890WriteFrame,
  writePayloadAt,
  enableAtD890AutoWriteAck,
} from './__fixtures__/scriptedPipe.ts';
import { AT_D890_MAP_SIZE, AT_D890_SAFE_SKIP_WRITE_ADDR } from './constants.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import { channelPrimaryAddress, channelSecondaryAddress } from './memory.ts';

import { listTouchedEraseUnits } from './eraseUnits.ts';

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
      new Uint8Array(0x10),
      NEGOTIATED_READ_BLOCK,
    );
    enqueueAtD890ReadReply(pipe, D890_MAP.RadioIdSet, new Uint8Array(0x20), NEGOTIATED_READ_BLOCK);
    enqueueAtD890ReadReply(
      pipe,
      D890_MAP.MasterIdData,
      new Uint8Array(0x40),
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

  it('refuses upload when LocalInfo serial does not match hydration stash', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, channelUploadMemory('LIVE-RADIO-XYZ'));

    const image = seedChannelZeroUpload(radio, 'STASH-RADIO-ABC');

    await expect(radio.upload(image, {})).rejects.toThrow(/serial/);
    expect(collectAtD890WriteDataAddresses(pipe)).toHaveLength(0);
  });

  it('preserves optional settings bytes when writing zone tables', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const unit350 = makeAtD890EraseUnitBuffer();
    unit350[0x05] = 0x42;
    unit350[0x900] = 0x01;
    unit350[0x1280] = 0x02;
    const memory = new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
      [0x350_0000, unit350],
    ]);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, memory);

    radio.seedDownloadCache({
      blocks: new Map([
        [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
        [D890_MAP.ZoneAChannel, new Uint8Array(D890_MAP.ZoneTableBytes).fill(0x11)],
        [D890_MAP.ZoneBChannel, new Uint8Array(D890_MAP.ZoneTableBytes)],
      ]),
    });
    const image = cacheToMemoryMap(radio.getDownloadCache()!);
    applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    expect(writePayloadAt(pipe, D890_MAP.OptionalSettingsMain)?.[0x05]).toBe(0x42);
    expect(collectAtD890ReadRequestAddresses(pipe)).toContain(0x350_0000);
  });

  it('skips all-0xff blocks inside touched erase units', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const unit350 = makeAtD890EraseUnitBuffer(0xff);
    unit350[0x05] = 0x01;
    unit350[0x900] = 0x01;
    unit350[0x1280] = 0x01;
    unit350[D890_MAP.ZoneAChannel - 0x350_0000] = 0x22;
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(
      pipe,
      new Map([
        [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
        [0x350_0000, unit350],
      ]),
    );

    radio.seedDownloadCache({
      blocks: new Map([
        [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
        [D890_MAP.ZoneAChannel, new Uint8Array(D890_MAP.ZoneTableBytes).fill(0x22)],
        [D890_MAP.ZoneBChannel, new Uint8Array(D890_MAP.ZoneTableBytes).fill(0xff)],
      ]),
    });
    const image = cacheToMemoryMap(radio.getDownloadCache()!);
    applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const written = collectAtD890WriteDataAddresses(pipe);
    expect(
      written.some((a) => a >= D890_MAP.ZoneBChannel && a < D890_MAP.ZoneBChannel + 0x200),
    ).toBe(false);
    expect(
      written.some((a) => a >= D890_MAP.ZoneAChannel && a < D890_MAP.ZoneAChannel + 0x10),
    ).toBe(true);
  });

  it('rejects upload without seeded blocks', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    await expect(radio.upload(image, {})).rejects.toThrow(/no sparse blocks/);
  });
});
