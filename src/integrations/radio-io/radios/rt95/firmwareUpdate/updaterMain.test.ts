import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { StockFirmwareDescriptor } from '@core/firmware/types.ts';
import { RT95_MAIN_STOCK_FIRMWARE } from '@core/radios/retevis/rt95/firmware.ts';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import { RadioInterlockError } from '../../../kit/errors.ts';
import { Rt95BootloaderMock } from './__fixtures__/rt95BootloaderMock.ts';
import {
  preparedRt95HeadImage,
  RT95_MAIN_GOLDEN_FRAMES,
  RT95_MAIN_GOLDEN_SHA256,
  RT95_MAIN_GOLDEN_STREAM_LEN,
  synthRt95MainPackage,
} from './__fixtures__/syntheticPackage.ts';
import { RT95_MAIN_FIRMWARE_UPDATER } from './descriptor.ts';
import { createRt95MainTarget, RT95_MAIN_TARGET } from './targets.ts';
import { createRt95FirmwareUpdater } from './updater.ts';

const GOLDEN_STOCK: StockFirmwareDescriptor = {
  ...RT95_MAIN_STOCK_FIRMWARE,
  members: RT95_MAIN_STOCK_FIRMWARE.members.map((m) => ({
    ...m,
    sha256: RT95_MAIN_GOLDEN_SHA256[m.role as 'cdd' | 'cdi' | 'spi'],
  })),
};
const FILES = synthRt95MainPackage();
const IMAGE = preparedRt95HeadImage(FILES, { radioId: 'retevis-rt95-main' });
const BRIDGE = { limit: 0x0800fc00 };

const golden = () => createRt95FirmwareUpdater(createRt95MainTarget(GOLDEN_STOCK));
const dataLog = (m: Rt95BootloaderMock) => m.log.filter((l) => l.startsWith('data '));

describe('RT95 MAIN updater: golden bridge session', () => {
  it('sends the image, never the 40-byte tail, and the golden stream hash', async () => {
    const mock = new Rt95BootloaderMock({ bridge: BRIDGE });
    const updater = golden();
    await updater.identify(mock);
    const result = await updater.flash(IMAGE, {});
    expect(result).toMatchObject({ dataFrames: RT95_MAIN_GOLDEN_FRAMES, end: 'acknowledged' });
    expect(dataLog(mock)).toHaveLength(RT95_MAIN_GOLDEN_FRAMES);
    expect(mock.violations).toEqual([]);
    expect(mock.image(0x08002000, 0xd93c)).toEqual(FILES.cdd.subarray(0, 0xd93c));
    expect(mock.received).toHaveLength(RT95_MAIN_GOLDEN_STREAM_LEN);
    expect(createHash('sha256').update(Uint8Array.from(mock.received)).digest('hex')).toBe(
      RT95_MAIN_GOLDEN_SHA256.stream,
    );
  });

  it('resends frame 3 after one NAK, then succeeds', async () => {
    const mock = new Rt95BootloaderMock({ bridge: BRIDGE, nakAt: [3] });
    const updater = golden();
    await updater.identify(mock);
    const result = await updater.flash(IMAGE, {});
    expect(result.dataFrames).toBe(RT95_MAIN_GOLDEN_FRAMES);
    expect(mock.frames).toBe(RT95_MAIN_GOLDEN_FRAMES + 1);
    expect(mock.violations).toEqual([]);
  });
});

describe('RT95 MAIN updater: refusals and modes', () => {
  it('refuses the golden against the real pinned stock before any frame is sent', async () => {
    const mock = new Rt95BootloaderMock({ bridge: BRIDGE });
    const updater = RT95_MAIN_FIRMWARE_UPDATER.createUpdater();
    await updater.identify(mock);
    const err = await updater.flash(IMAGE, {}).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(FirmwareFlashError);
    expect(((err as FirmwareFlashError).cause as Error).message).toMatch(/pinned stock/);
    expect(((err as FirmwareFlashError).cause as Error) instanceof RadioInterlockError).toBe(true);
    expect(mock.frames).toBe(0);
  });

  it('the registered updater has the MAIN radio id and the MAIN profile', () => {
    expect(RT95_MAIN_FIRMWARE_UPDATER.radioId).toBe('retevis-rt95-main');
    expect(RT95_MAIN_FIRMWARE_UPDATER.prodFlashDisabled).toBe(true);
    expect(RT95_MAIN_FIRMWARE_UPDATER.createUpdater().radioId).toBe(RT95_MAIN_TARGET.radioId);
  });

  it('a silent MAIN gives the main-board update-mode copy', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'silent', bridge: BRIDGE });
    await expect(RT95_MAIN_FIRMWARE_UPDATER.createUpdater().identify(mock)).rejects.toThrow(
      /Is the main board in update mode\?.*UPDATE THE RF CPU/,
    );
  });

  it('normal mode (QX 06) sends END and gives the MAIN normal-mode copy', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'normal', bridge: BRIDGE });
    await expect(RT95_MAIN_FIRMWARE_UPDATER.createUpdater().identify(mock)).rejects.toThrow(
      /switched on normally.*UPDATE THE RF CPU/,
    );
    expect(mock.log).toEqual(['PROGRAM', 'END']);
    expect(mock.frames).toBe(0);
  });
});
