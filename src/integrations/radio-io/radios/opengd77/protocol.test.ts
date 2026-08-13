import { describe, expect, it } from 'vitest';
import {
  OPENGD77_BLOCK,
  OPENGD77_SECTOR,
  OPENGD77_TYPE_READ,
  OPENGD77_TYPE_WRITE_UV380,
  OPENGD77_WRITE_CMD_SECTOR_BUFFER,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../kit/codecs/opengd77Serial.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import { OPENUV380_OFFSET } from './constants.ts';
import { createOpenUv380Image, readAbs } from './memory.ts';
import { OpenGd77Protocol, createOpenGd77Md9600Protocol, parseFirmwareInfo } from './protocol.ts';
import { openGd77KeptRegionLength } from './writeVerifySupport.ts';
import {
  makeOpenGd77FirmwareInfoPayload,
  OpenGd77ScriptedPipe,
} from './__fixtures__/scriptedPipe.ts';

describe('parseFirmwareInfo', () => {
  it('parses radioType and revision', () => {
    const info = parseFirmwareInfo(makeOpenGd77FirmwareInfoPayload(0x08));
    expect(info.radioType).toBe(0x08);
    expect(info.fwRevision).toBe('R20240101000000');
  });
});

describe('OpenGd77Protocol', () => {
  it('connects, downloads registered spans, rejects wrong radioType', async () => {
    const bad = new OpenGd77ScriptedPipe(0x05); // MD-9600
    const protoBad = new OpenGd77Protocol();
    await expect(protoBad.connect(bad)).rejects.toThrow(/radioType/);

    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.plantByte(OPENUV380_OFFSET.channelBank0 + 0x10, 0xaa);
    const proto = new OpenGd77Protocol();
    const ident = await proto.connect(pipe);
    expect(ident.firmwareHint).toBe('R20240101000000');

    const image = await proto.download({});
    expect(readAbs(image, OPENUV380_OFFSET.channelBank0 + 0x10, 1)[0]).toBe(0xaa);
  });

  it('connects MD-9600 radioType 0x05', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x05);
    const proto = createOpenGd77Md9600Protocol() as OpenGd77Protocol;
    const ident = await proto.connect(pipe);
    expect(ident.firmwareHint).toBe('R20240101000000');
    expect(proto.getFirmwareInfo()?.radioType).toBe(0x05);
  });

  it('uploads dirty flash sectors with X framing', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);
    const prior = await proto.download({});

    const next = createOpenUv380Image();
    next.bytes.set(prior.bytes);
    encodeChannelsIntoImage(next, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'UP',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
        mode: 'analog',
      },
    ]);

    await proto.upload(next, {});

    const setSectorWrites = pipe.writes.filter(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SET_SECTOR,
    );
    expect(setSectorWrites.length).toBeGreaterThan(0);

    const bufferWrites = pipe.writes.filter(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SECTOR_BUFFER,
    );
    expect(bufferWrites.length).toBe(setSectorWrites.length * (OPENGD77_SECTOR / OPENGD77_BLOCK));
  });

  it('upload performs in-session pre-write read before programming flash', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.plantByte(OPENUV380_OFFSET.channelBank0 + 0x10, 0xaa);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);

    const next = createOpenUv380Image();
    encodeChannelsIntoImage(next, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'UP',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
        mode: 'analog',
      },
    ]);

    const progressStages: string[] = [];
    await proto.upload(next, {
      onProgress: (p) => {
        if (p.stage) progressStages.push(p.stage);
      },
    });

    const firstReadIdx = pipe.writes.findIndex((w) => w[0] === OPENGD77_TYPE_READ && w[1] === 0x01);
    const firstWriteIdx = pipe.writes.findIndex(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SET_SECTOR,
    );
    expect(firstReadIdx).toBeGreaterThanOrEqual(0);
    expect(firstWriteIdx).toBeGreaterThanOrEqual(0);
    expect(firstReadIdx).toBeLessThan(firstWriteIdx);

    expect(progressStages).toContain('Pre-write read');
    expect(progressStages).toContain('FLASH sectors');
  });

  it('upload captures kept regions from pre-write read priorImage', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const settingsMarker = 0x42;
    pipe.plantByte(OPENUV380_OFFSET.settings, settingsMarker);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);

    const next = createOpenUv380Image();
    encodeChannelsIntoImage(next, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'UP',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
        mode: 'analog',
      },
    ]);

    await proto.upload(next, {});

    const kept = proto.takeUploadKeptSnapshot();
    expect(kept).toBeDefined();
    const settingsLen = openGd77KeptRegionLength('settings');
    const settingsBefore = kept!.get('settings');
    expect(settingsBefore).toBeDefined();
    expect(settingsBefore!.length).toBe(settingsLen);
    expect(settingsBefore![0]).toBe(settingsMarker);
  });

  it('armed write projection overlays onto pre-write prior and keeps settings', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const settingsMarker = 0x5a;
    pipe.plantByte(OPENUV380_OFFSET.settings, settingsMarker);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);

    proto.armWriteProjection([
      {
        slotIndex: 1,
        empty: false,
        wireName: 'LIVE',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
        mode: 'analog',
      },
    ]);

    const ignoredVirgin = createOpenUv380Image();
    await proto.upload(ignoredVirgin, {});

    expect(pipe.flashByte(OPENUV380_OFFSET.settings)).toBe(settingsMarker);
    const channels = proto.decodeChannels(proto.getPriorImage()!);
    expect(channels.some((ch) => ch.wireName === 'LIVE')).toBe(true);
  });
});
