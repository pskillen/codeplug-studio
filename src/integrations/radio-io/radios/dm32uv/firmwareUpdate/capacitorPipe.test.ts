/**
 * The DM-32UV updater end to end through the Android app's real pipe (`CapacitorSerialBytePipe`), over a fake
 * USB-serial plugin backed by the bootloader mock. The cable is chosen by the link's filters and opened at the link's
 * rate with its DTR/RTS choice, as the flasher does. Synthetic image only; nothing here touches a radio or a phone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DM32UV_FIRMWARE_BLOCK0_FILE_NAME } from '@core/radios/baofeng/dm-32uv/firmware.ts';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import {
  openCapacitorSerialPipe,
  requestCapacitorSerialPort,
} from '../../../transport/capacitorSerialPipe.ts';
import {
  createMockRadioCapacitorPlugin,
  type MockRadioCapacitorPluginOptions,
} from '../../../transport/__fixtures__/mockRadioCapacitorPlugin.ts';
import { Dm32BootloaderMock } from './__fixtures__/dm32BootloaderMock.ts';
import { preparedDm32Image, syntheticDm32Image } from './__fixtures__/syntheticImage.ts';
import { DM32_FW_LINK } from './constants.ts';
import { createDm32FirmwareUpdater } from './updater.ts';

const BIN = syntheticDm32Image();
const IMAGE = preparedDm32Image(BIN);
/** 6 ident steps, block 0 with the erase, 840 data blocks as type byte plus block, EOT. */
const STOCK_FRAMES = 6 + 1 + 840 * 2 + 1;

async function session(
  mock: Dm32BootloaderMock,
  pluginOpts: MockRadioCapacitorPluginOptions = {},
  preSendDelayMs = 0,
) {
  const { plugin, record } = createMockRadioCapacitorPlugin(mock, pluginOpts);
  const device = await requestCapacitorSerialPort({ usbFilters: DM32_FW_LINK.usbFilters, plugin });
  const pipe = await openCapacitorSerialPipe(device, DM32_FW_LINK.baudRate, {
    plugin,
    raiseDtrRts: DM32_FW_LINK.raiseDtrRts,
  });
  const updater = createDm32FirmwareUpdater({ preSendDelayMs });
  const run = async () => {
    try {
      await updater.identify(pipe);
      return await updater.flash(IMAGE, {});
    } finally {
      await pipe.close();
    }
  };
  return { run, record };
}

async function flashError(promise: Promise<unknown>): Promise<FirmwareFlashError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(FirmwareFlashError);
  return err as FirmwareFlashError;
}

/**
 * Run `promise` to completion under fake timers, stepping the clock. Every case runs on fake time: the pipe paces
 * writes at the line's wire time (about 90 ms per 1 KiB block at 115200), which would make a real-time run take
 * minutes.
 */
async function underFakeTime<T>(promise: Promise<T>, stepMs = 100): Promise<T> {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  while (!settled) await vi.advanceTimersByTimeAsync(stepMs);
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DM-32UV updater through the Capacitor pipe', () => {
  it('flashes the whole image: CH340 at 115200, DTR/RTS high, port closed', async () => {
    const mock = new Dm32BootloaderMock();
    const { run, record } = await session(mock);
    const result = await underFakeTime(run());
    expect(result).toMatchObject({ framesSent: STOCK_FRAMES, dataFrames: 840, end: 'eot-sent' });
    expect(mock.violations).toEqual([]);
    expect(mock.erased && mock.eotSeen).toBe(true);
    expect(mock.body).toEqual(BIN.slice(0x100));
    expect(new TextDecoder().decode(mock.meta)).toBe(
      `${DM32UV_FIRMWARE_BLOCK0_FILE_NAME}\x00860160`,
    );
    expect(mock.frames).toHaveLength(STOCK_FRAMES);
    expect(record.writes).toBe(STOCK_FRAMES);
    expect(record.baudRates).toEqual([115_200]);
    expect(record.signals).toEqual([
      { line: 'dtr', value: true },
      { line: 'rts', value: true },
    ]);
    expect(record.closed).toBe(true);
  }, 30_000);

  it('stops after a silent block: a timeout, radio touched, nothing more sent', async () => {
    // Reply 400 is the ACK of a data block in the transfer.
    const mock = new Dm32BootloaderMock({ silentAt: 400 });
    const { run } = await session(mock);
    const err = await flashError(underFakeTime(run()));
    expect(err.code).toBe('timeout');
    expect(err.radioTouched).toBe(true);
    expect(err.position).toBe(`block#${(400 - 8) / 2}`);
    expect(mock.frames).toHaveLength(401);
  });

  it('stops when the cable is pulled mid-transfer: closed, radio touched, nothing more sent', async () => {
    const mock = new Dm32BootloaderMock();
    // Write 301 is data block 146 (6 ident writes, block 0, then a type byte and a block per data block).
    const { run, record } = await session(mock, { cutAfterWrites: 301 });
    const err = await flashError(underFakeTime(run()));
    expect(err.code).toBe('closed');
    expect(err.radioTouched).toBe(true);
    expect(err.position).toBe('block#146');
    expect(record.cut).toBe(true);
    expect(mock.frames).toHaveLength(301);
  });

  it('holds its timeouts with a phone-like delay on every event and the 10 ms pre-send pause', async () => {
    const mock = new Dm32BootloaderMock();
    const { run, record } = await session(mock, { eventDelayMs: 20 }, 10);
    const result = await underFakeTime(run());
    expect(result).toMatchObject({ framesSent: STOCK_FRAMES, end: 'eot-sent' });
    expect(mock.body).toEqual(BIN.slice(0x100));
    // Every step waited for its pause and its delayed reply.
    expect(result.elapsedMs).toBeGreaterThanOrEqual((STOCK_FRAMES - 6) * 30);
    expect(record.events).toBeGreaterThanOrEqual(STOCK_FRAMES);
  }, 30_000);

  it('a delay longer than the 0.5 s handshake timeout is a timeout before anything is erased', async () => {
    const mock = new Dm32BootloaderMock();
    const { plugin } = createMockRadioCapacitorPlugin(mock, { eventDelayMs: 600 });
    const device = await requestCapacitorSerialPort({
      usbFilters: DM32_FW_LINK.usbFilters,
      plugin,
    });
    const pipe = await openCapacitorSerialPipe(device, DM32_FW_LINK.baudRate, { plugin });
    const err = await underFakeTime(
      createDm32FirmwareUpdater({ preSendDelayMs: 0 })
        .identify(pipe)
        .then(
          () => null,
          (e: unknown) => e,
        ),
    );
    await pipe.close();
    expect(err).toMatchObject({ code: 'timeout' });
    expect(mock.erased).toBe(false);
    expect(mock.frames).toHaveLength(1);
  });
});
