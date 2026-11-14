/**
 * The AT-D890UV updater end to end through the Android app's real pipe (`CapacitorSerialBytePipe`), over a fake
 * USB-serial plugin backed by the bootloader mock. The radio's own CDC port is chosen by the link's filters and opened
 * at the link's rate with its DTR/RTS choice, as the flasher does. Synthetic package only; nothing here touches a
 * radio or a phone.
 *
 * Every case runs on fake time: the pipe paces writes at the link's nominal wire time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import {
  openCapacitorSerialPipe,
  requestCapacitorSerialPort,
} from '../../../transport/capacitorSerialPipe.ts';
import {
  createMockRadioCapacitorPlugin,
  MOCK_ST_CDC_DEVICE,
  type MockRadioCapacitorPluginOptions,
} from '../../../transport/__fixtures__/mockRadioCapacitorPlugin.ts';
import { D890BootloaderMock } from './__fixtures__/d890BootloaderMock.ts';
import { preparedD890Image, synthD890Package } from './__fixtures__/syntheticPackage.ts';
import { AT_D890_FW_LINK } from './constants.ts';
import { createD890FirmwareUpdater } from './updater.ts';

/** 4,096 bytes: 128 frames of 32. */
const LENGTH = 4096;
const FRAMES = LENGTH / 32;
const FILES = synthD890Package(0x0800c000, LENGTH);
const IMAGE = preparedD890Image(FILES);

async function session(mock: D890BootloaderMock, pluginOpts: MockRadioCapacitorPluginOptions = {}) {
  const { plugin, record } = createMockRadioCapacitorPlugin(mock, {
    device: MOCK_ST_CDC_DEVICE,
    ...pluginOpts,
  });
  const device = await requestCapacitorSerialPort({
    usbFilters: AT_D890_FW_LINK.usbFilters,
    plugin,
  });
  const pipe = await openCapacitorSerialPipe(device, AT_D890_FW_LINK.baudRate, {
    plugin,
    raiseDtrRts: AT_D890_FW_LINK.raiseDtrRts,
  });
  const updater = createD890FirmwareUpdater();
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

/** Run `promise` to completion under fake timers, stepping the clock. */
async function underFakeTime<T>(promise: Promise<T>, stepMs = 100): Promise<T> {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  while (!settled) await vi.advanceTimersByTimeAsync(stepMs);
  return promise;
}

const dataLog = (m: D890BootloaderMock) => m.log.filter((l) => l.startsWith('data '));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AT-D890UV updater through the Capacitor pipe', () => {
  it('flashes the whole package: the CDC port at the link rate, DTR/RTS high, port closed', async () => {
    const mock = new D890BootloaderMock();
    const { run, record } = await session(mock);
    const result = await underFakeTime(run());
    expect(result).toMatchObject({
      dataFrames: FRAMES,
      framesSent: FRAMES + 3,
      end: 'acknowledged',
    });
    expect(dataLog(mock)).toHaveLength(FRAMES);
    expect(mock.image(0x0800c000, LENGTH)).toEqual(FILES.cdd);
    expect(mock.log.filter((l) => l.startsWith('unknown') || l === 'badframe')).toEqual([]);
    expect(record.baudRates).toEqual([AT_D890_FW_LINK.baudRate]);
    expect(record.signals).toEqual([
      { line: 'dtr', value: true },
      { line: 'rts', value: true },
    ]);
    expect(record.closed).toBe(true);
  });

  it('resends a frame once after a NAK, then succeeds', async () => {
    const mock = new D890BootloaderMock({ nakAt: [7] });
    const { run } = await session(mock);
    const result = await underFakeTime(run());
    expect(result.end).toBe('acknowledged');
    expect(result.framesSent).toBe(FRAMES + 3 + 1);
    expect(mock.image(0x0800c000, LENGTH)).toEqual(FILES.cdd);
  });

  it('resends a frame once after it stays silent past the 2 s frame timeout, then succeeds', async () => {
    const mock = new D890BootloaderMock({ silentAt: [7] });
    const { run } = await session(mock);
    const result = await underFakeTime(run());
    expect(result.end).toBe('acknowledged');
    expect(result.framesSent).toBe(FRAMES + 3 + 1);
    expect(mock.image(0x0800c000, LENGTH)).toEqual(FILES.cdd);
    expect(result.timing!.maxFrameMs).toBeGreaterThanOrEqual(2000);
  });

  it('stops after a frame stays silent twice: radio touched, frame 7, nothing more sent', async () => {
    // The mock counts every frame it receives, so frame 7's resend is its eighth.
    const mock = new D890BootloaderMock({ silentAt: [7, 8] });
    const { run, record } = await session(mock);
    const err = await flashError(underFakeTime(run()));
    // Two failed attempts surface as the updater's "did not accept" protocol error, not the read timeout.
    expect(err.code).toBe('protocol');
    expect(err.message).toMatch(/after 2 attempts \(last reply nothing\)/);
    expect(err.radioTouched).toBe(true);
    expect(err.position).toMatch(/^frame 7\//);
    // UPDATE, ident, data frames 1 to 6, and frame 7 twice: no further write, no end byte.
    expect(record.writes).toBe(2 + 6 + 2);
    expect(dataLog(mock)).toHaveLength(6);
    expect(mock.log).not.toContain('end');
  });

  it('stops when the cable is pulled mid-transfer: closed, radio touched, no end byte', async () => {
    // Writes 1 and 2 are UPDATE and the ident request; write 52 is data frame 50.
    const mock = new D890BootloaderMock();
    const { run, record } = await session(mock, { cutAfterWrites: 52 });
    const err = await flashError(underFakeTime(run()));
    expect(err.code).toBe('closed');
    expect(err.radioTouched).toBe(true);
    expect(err.position).toMatch(/^frame 50\//);
    expect(record.cut).toBe(true);
    expect(mock.log).not.toContain('end');
  });

  it('a write the plugin rejects on a cable pull surfaces as a protocol error, radio touched, nothing more sent', async () => {
    // Write 52 (data frame 50) is refused by the plugin and never reaches the radio. The pipe passes the plugin's
    // raw IO_ERROR through, so the code is 'protocol', not 'closed'; recovery is the same (radio touched).
    const mock = new D890BootloaderMock();
    const { run, record } = await session(mock, { cutAfterWrites: 52, rejectWriteOnCut: true });
    const err = await flashError(underFakeTime(run()));
    expect(err.code).toBe('protocol');
    expect(err.message).toBe('IO_ERROR');
    expect(err.radioTouched).toBe(true);
    expect(err.position).toMatch(/^frame 50\//);
    expect(record.cut).toBe(true);
    expect(record.writes).toBe(51);
    expect(dataLog(mock)).toHaveLength(49);
    expect(mock.log).not.toContain('end');
  });

  it('holds its 2 s frame timeout with a phone-like delay on every reply, and the time adds up per frame', async () => {
    const mock = new D890BootloaderMock();
    const { run } = await session(mock, { eventDelayMs: 5 });
    const result = await underFakeTime(run());
    expect(result).toMatchObject({ framesSent: FRAMES + 3, end: 'acknowledged' });
    expect(mock.image(0x0800c000, LENGTH)).toEqual(FILES.cdd);
    // One round trip per 40-byte frame: the per-reply delay is paid on every frame.
    expect(result.timing!.medianFrameMs).toBeGreaterThanOrEqual(5);
    expect(result.timing!.maxFrameMs).toBeLessThan(2000);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(FRAMES * 5);
  });
});
