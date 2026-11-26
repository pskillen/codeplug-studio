/**
 * Cable merge of the RadioFoundry settings area. Refusals use the fake radio
 * and a settings sector; successful writes use the scripted pipe, which keeps
 * the blocks it accepts.
 */

import { describe, expect, it } from 'vitest';
import { newChannel, newOwnDigitalId } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import { encodeM17CallsignRecord } from '@core/import-export/formats/radiofoundry/m17.ts';
import {
  RADIOFOUNDRY_IMAGE_SIZE,
  SETTINGS_AREA_ADDRESS,
  channelSlotAddress,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import { readRadioFoundrySettingsArea } from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import { encodeRadioFoundrySettingsSector } from '@core/import-export/formats/radiofoundry/settingsAreaWrite.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { memoryMapFromBytes, memoryMapToBytes } from '../../kit/memoryMap.ts';
import { decodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import { RadioInterlockError } from '../../kit/errors.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  OP_BEGIN,
  OP_BLOCK,
  OP_READ,
  PHYSICAL_CODEPLUG_BASE,
} from './constants.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import { radioWithSettingsSector } from './__fixtures__/settingsSector.ts';
import { RadioFoundryCableProtocol, RF_SETTINGS_NEWER, RF_SETTINGS_STALE } from './protocol.ts';
import { ScriptedPipe } from './protocol.test.ts';
import {
  radioFoundryWriteSourceFromAssembled,
  type RadioFoundryCableSettingsIntent,
  type RadioFoundryWriteSource,
} from './writeSource.ts';

const DM32_FAKE = { physicalBase: PHYSICAL_CODEPLUG_BASE };

function sector(entries: { key: number; value: Uint8Array }[]): Uint8Array {
  const encoded = encodeRadioFoundrySettingsSector(entries);
  if (!encoded.ok) throw new Error(`fixture overflow ${encoded.overflowBytes}`);
  return encoded.sector;
}

function codeplugOps(writes: Uint8Array[], from = 0): number[] {
  return writes
    .slice(from)
    .map((frame) => decodeDebugFrame(frame))
    .filter((frame) => frame.command === CODEPLUG_COMMAND)
    .map((frame) => frame.payload[0]!);
}

function writtenBlocks(pipe: ScriptedPipe): number[] {
  return pipe.writes
    .map((frame) => decodeDebugFrame(frame))
    .filter((frame) => frame.payload[0] === OP_BLOCK)
    .map(
      (frame) =>
        frame.payload[1]! |
        (frame.payload[2]! << 8) |
        (frame.payload[3]! << 16) |
        (frame.payload[4]! << 24),
    );
}

function blankImage(): { bytes: Uint8Array; owned: Uint8Array } {
  return {
    bytes: new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE).fill(0xff),
    owned: new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE),
  };
}

function mergingSource(
  partial: Partial<RadioFoundryCableSettingsIntent> = {},
  channelNumber = 1,
): RadioFoundryWriteSource {
  const image = blankImage();
  const slot = channelSlotAddress(channelNumber);
  image.owned[slot.bitmap] = 1;
  image.bytes[slot.bitmap] = 1;
  image.owned[slot.record] = 1;
  image.bytes[slot.record] = 0x41;
  return {
    ...image,
    warnings: [],
    settings: {
      ownsChannelTable: true,
      channelTags: partial.channelTags ?? new Map(),
      ...(partial.callsignRecord ? { callsignRecord: partial.callsignRecord } : {}),
    },
  };
}

const TAG = Uint8Array.of(6, 0xff, 0xa9, 0x18, 0x01, 0x03, 0, 0, 0, 0, 0, 0);

function ignoredImage() {
  return memoryMapFromBytes(Uint8Array.of(0));
}

async function connectScripted(fill = 0xff): Promise<{
  pipe: ScriptedPipe;
  proto: RadioFoundryCableProtocol;
}> {
  const pipe = new ScriptedPipe(fill);
  const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
  await proto.connect(pipe);
  return { pipe, proto };
}

describe('RadioFoundry settings merge refusals', () => {
  it('refuses a stale settings read before BEGIN', async () => {
    const pipe = radioWithSettingsSector(
      sector([{ key: 0x0003, value: Uint8Array.of(1) }]),
      DM32_FAKE,
    );
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    await proto.download({});
    proto.armWriteSource(mergingSource());
    const from = pipe.writes.length;
    const err = await proto.upload(ignoredImage(), {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioInterlockError);
    expect((err as Error).message).toBe(RF_SETTINGS_STALE);
    expect((err as RadioInterlockError).retry).toBe('none');
    expect((err as RadioInterlockError).sent).toBe('nothing-sent');
    const ops = codeplugOps(pipe.writes, from);
    expect(ops).not.toContain(OP_BEGIN);
    expect(ops).not.toContain(OP_BLOCK);
  });

  it('refuses a source that owns a settings byte before BEGIN', async () => {
    const pipe = radioWithSettingsSector(new Uint8Array(0x1000).fill(0xff), DM32_FAKE);
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const from = pipe.writes.length;
    const image = blankImage();
    image.owned[SETTINGS_AREA_ADDRESS + 4] = 1;
    expect(() => proto.armWriteSource({ ...image, warnings: [] })).toThrow(/settings area/);
    const ops = codeplugOps(pipe.writes, from);
    expect(ops).not.toContain(OP_BEGIN);
    expect(ops).not.toContain(OP_BLOCK);
  });

  it('refuses a newer area before BEGIN', async () => {
    const newer = sector([{ key: 0x0001, value: Uint8Array.of(1) }]);
    newer[4] = 2;
    const pipe = radioWithSettingsSector(newer, DM32_FAKE);
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    proto.armWriteSource(mergingSource());
    await proto.download({ progressStage: 'Pre-write read' });
    const from = pipe.writes.length;
    const err = await proto.upload(ignoredImage(), {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioInterlockError);
    expect((err as Error).message).toBe(RF_SETTINGS_NEWER);
    expect((err as RadioInterlockError).sent).toBe('nothing-sent');
    const ops = codeplugOps(pipe.writes, from);
    expect(ops).not.toContain(OP_BEGIN);
    expect(ops).not.toContain(OP_BLOCK);
  });

  it('refuses an overflow before BEGIN', async () => {
    const full = sector([{ key: 0x0001, value: new Uint8Array(4070) }]);
    const pipe = radioWithSettingsSector(full, DM32_FAKE);
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    proto.armWriteSource(mergingSource({ channelTags: new Map([[1, TAG]]) }));
    await proto.download({ progressStage: 'Pre-write read' });
    const from = pipe.writes.length;
    const err = await proto.upload(ignoredImage(), {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioInterlockError);
    expect((err as Error).message).toMatch(/short by/);
    expect((err as RadioInterlockError).sent).toBe('nothing-sent');
    const ops = codeplugOps(pipe.writes, from);
    expect(ops).not.toContain(OP_BEGIN);
    expect(ops).not.toContain(OP_BLOCK);
  });
});

describe('RadioFoundry settings merge write', () => {
  it('reads the settings block even when another block is fully owned', async () => {
    const { pipe, proto } = await connectScripted(0xff);
    const kept = sector([{ key: 0x0300, value: Uint8Array.of(0xde, 0xad) }]);
    pipe.block(SETTINGS_AREA_ADDRESS).set(kept);
    const image = blankImage();
    image.owned.fill(1, 0, BLOCK_SIZE);
    const slot = channelSlotAddress(1);
    image.owned[slot.bitmap] = 1;
    image.bytes[slot.bitmap] = 1;
    proto.armWriteSource({ ...image, warnings: [] });
    const from = pipe.writes.length;
    await proto.download({ progressStage: 'Pre-write read' });
    const readAfter = pipe.writes
      .slice(from)
      .map((frame) => decodeDebugFrame(frame))
      .filter((frame) => frame.payload[0] === OP_READ)
      .map(
        (frame) =>
          frame.payload[1]! |
          (frame.payload[2]! << 8) |
          (frame.payload[3]! << 16) |
          (frame.payload[4]! << 24),
      );
    expect(readAfter).toContain(SETTINGS_AREA_ADDRESS);
    expect(readAfter).not.toContain(0);
    expect(proto.settingsArea()?.entries.map((entry) => entry.key)).toEqual([0x0300]);
  });

  it('writes channel blocks before the settings block and keeps unknown keys and callsign tails', async () => {
    const { pipe, proto } = await connectScripted();
    const callsign = encodeM17CallsignRecord('Q0TEST')!;
    const stored = new Uint8Array(callsign.length + 2);
    stored.set(callsign);
    stored[10] = 0xab;
    stored[11] = 0xcd;
    pipe.block(SETTINGS_AREA_ADDRESS).set(
      sector([
        { key: 0x0300, value: Uint8Array.of(0x11, 0x22) },
        { key: 0x0400, value: Uint8Array.of(2, 0xff, 0, 0, 1) },
        { key: 0x0401, value: Uint8Array.of(6, 0xff, 0, 0, 1, 1, 2, 3, 4, 5, 6, 7) },
        { key: 0x0a06, value: stored },
      ]),
    );
    const next = encodeM17CallsignRecord('AB1CD')!;
    const channel = 129;
    const slot = channelSlotAddress(channel);
    const blockAddr = slot.bitmap - (slot.bitmap % BLOCK_SIZE);
    proto.armWriteSource(
      mergingSource({ channelTags: new Map([[channel, TAG]]), callsignRecord: next }, channel),
    );
    await proto.download({ progressStage: 'Pre-write read' });
    const overlay = memoryMapToBytes(proto.overlayWriteImage());
    const planned = proto.plannedBlockCounts();
    await proto.upload(ignoredImage(), {});
    const written = writtenBlocks(pipe);
    expect(written.indexOf(SETTINGS_AREA_ADDRESS)).toBeGreaterThan(written.indexOf(blockAddr));
    expect(written.length).toBe(planned?.write);
    expect([...overlay.subarray(SETTINGS_AREA_ADDRESS, SETTINGS_AREA_ADDRESS + 0x1000)]).toEqual([
      ...pipe.block(SETTINGS_AREA_ADDRESS),
    ]);
    const entries = readRadioFoundrySettingsArea(pipe.block(SETTINGS_AREA_ADDRESS)).entries;
    expect(entries.map((entry) => entry.key)).toEqual([0x0300, 0x0a06, 0x0400 + channel - 1]);
    expect([...entries[1]!.value.subarray(0, 10)]).toEqual([...next]);
    expect([...entries[1]!.value.subarray(10)]).toEqual([0xab, 0xcd]);
    expect([...entries[2]!.value]).toEqual([...TAG]);
  });

  it('drops every old channel tag on an FM write and leaves a write that does not own the table', async () => {
    const fm = radioFoundryWriteSourceFromAssembled(fmAssembled());
    const { pipe, proto } = await connectScripted();
    pipe.block(SETTINGS_AREA_ADDRESS).set(
      sector([
        { key: 0x0009, value: Uint8Array.of(0x44) },
        { key: 0x0400, value: Uint8Array.of(5, 0xff, 1, 2, 0) },
        { key: 0x0402, value: Uint8Array.of(6, 0xff, 3, 4, 1, 9, 9, 9, 9, 9, 9, 9) },
      ]),
    );
    proto.armWriteSource(fm);
    await proto.download({ progressStage: 'Pre-write read' });
    await proto.upload(ignoredImage(), {});
    const afterFm = readRadioFoundrySettingsArea(pipe.block(SETTINGS_AREA_ADDRESS)).entries.map(
      (entry) => entry.key,
    );
    expect(afterFm).toEqual([0x0009]);

    const { pipe: left, proto: leftProto } = await connectScripted();
    const kept = sector([{ key: 0x0400, value: Uint8Array.of(4, 0xff, 1, 2, 0) }]);
    left.block(SETTINGS_AREA_ADDRESS).set(kept);
    const image = blankImage();
    image.owned[0x00e0] = 1;
    image.bytes[0x00e0] = 0x54;
    leftProto.armWriteSource({ ...image, warnings: [] });
    await leftProto.download({ progressStage: 'Pre-write read' });
    await leftProto.upload(ignoredImage(), {});
    expect(writtenBlocks(left)).not.toContain(SETTINGS_AREA_ADDRESS);
    expect([...left.block(SETTINGS_AREA_ADDRESS)]).toEqual([...kept]);
  });

  it('omits 0xE000 on a repeat write', async () => {
    const { pipe, proto } = await connectScripted();
    proto.armWriteSource(mergingSource({ channelTags: new Map([[1, TAG]]) }));
    await proto.download({ progressStage: 'Pre-write read' });
    await proto.upload(ignoredImage(), {});
    expect(writtenBlocks(pipe)).toContain(SETTINGS_AREA_ADDRESS);
    const from = pipe.writes.length;
    await proto.upload(ignoredImage(), {});
    const second = pipe.writes
      .slice(from)
      .map((frame) => decodeDebugFrame(frame))
      .filter((frame) => frame.payload[0] === OP_BLOCK)
      .map(
        (frame) =>
          frame.payload[1]! |
          (frame.payload[2]! << 8) |
          (frame.payload[3]! << 16) |
          (frame.payload[4]! << 24),
      );
    expect(second).not.toContain(SETTINGS_AREA_ADDRESS);
  });
});

function fmChannel(name: string): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    modeProfiles: [
      { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
    ],
  };
  return { entity, wireName: name };
}

function fmAssembled(): AssembledBuild {
  const channel = fmChannel('Local');
  return {
    buildId: 'b',
    formatId: 'radiofoundry',
    profileId: 'radiofoundry-dm32uv',
    buildName: 'DM-32',
    channels: [channel],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    ownDigitalIds: [{ ...newOwnDigitalId('p', 'dmr', 'MM9PDY', 2_351_234), isDefault: true }],
  };
}
