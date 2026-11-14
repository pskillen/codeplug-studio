/**
 * The RT95 head updater end to end through the Android app's real pipe (`CapacitorSerialBytePipe`), over a fake
 * USB-serial plugin backed by the bootloader mock (with the cable's echo on). The cable is chosen by the link's
 * filters and opened at the link's rate with its DTR/RTS choice, as the flasher does. Synthetic package only;
 * nothing here touches a radio or a phone.
 *
 * Every case runs on fake time: the pipe paces writes at the line's wire time (about 90 ms per 1,032-byte frame at
 * 115200), and a silent frame waits out a 3 s timeout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import {
  openCapacitorSerialPipe,
  requestCapacitorSerialPort,
} from '../../../transport/capacitorSerialPipe.ts';
import {
  createMockRadioCapacitorPlugin,
  MOCK_PL2303GC_DEVICE,
  type MockRadioCapacitorPluginOptions,
} from '../../../transport/__fixtures__/mockRadioCapacitorPlugin.ts';
import { Rt95BootloaderMock } from './__fixtures__/rt95BootloaderMock.ts';
import {
  preparedRt95HeadImage,
  RT95_GOLDEN_FRAMES,
  synthRt95HeadPackage,
} from './__fixtures__/syntheticPackage.ts';
import { RT95_HEAD_FW_LINK } from './constants.ts';
import { createRt95HeadFirmwareUpdater } from './updater.ts';

const FILES = synthRt95HeadPackage();
const IMAGE = preparedRt95HeadImage(FILES);

async function session(mock: Rt95BootloaderMock, pluginOpts: MockRadioCapacitorPluginOptions = {}) {
  const { plugin, record } = createMockRadioCapacitorPlugin(mock, {
    device: MOCK_PL2303GC_DEVICE,
    ...pluginOpts,
  });
  const device = await requestCapacitorSerialPort({
    usbFilters: RT95_HEAD_FW_LINK.usbFilters,
    plugin,
  });
  const pipe = await openCapacitorSerialPipe(device, RT95_HEAD_FW_LINK.baudRate, {
    plugin,
    raiseDtrRts: RT95_HEAD_FW_LINK.raiseDtrRts,
  });
  const updater = createRt95HeadFirmwareUpdater();
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

const dataLog = (m: Rt95BootloaderMock) => m.log.filter((l) => l.startsWith('data '));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RT95 head updater through the Capacitor pipe', () => {
  it('flashes the whole package: PL2303GC at 115200, DTR/RTS high, echo checked, port closed', async () => {
    const mock = new Rt95BootloaderMock();
    const { run, record } = await session(mock);
    const result = await underFakeTime(run());
    expect(result).toMatchObject({
      dataFrames: RT95_GOLDEN_FRAMES,
      framesSent: RT95_GOLDEN_FRAMES + 2,
      end: 'acknowledged',
    });
    expect(dataLog(mock)).toHaveLength(RT95_GOLDEN_FRAMES);
    expect(mock.image(0x08002000, FILES.cdd.length)).toEqual(FILES.cdd);
    expect(mock.log.filter((l) => l.startsWith('unknown') || l === 'badframe')).toEqual([]);
    expect(record.baudRates).toEqual([115_200]);
    expect(record.signals).toEqual([
      { line: 'dtr', value: true },
      { line: 'rts', value: true },
    ]);
    // Each 1,032-byte echo arrives split over several events, as USB packets do.
    expect(record.events).toBeGreaterThan(RT95_GOLDEN_FRAMES * 16);
    expect(record.closed).toBe(true);
    expect(result.timing).toBeDefined();
  });

  it('resends after a NAK and after a silent frame, then succeeds', async () => {
    const mock = new Rt95BootloaderMock({ nakAt: [3], silentAt: [10] });
    const { run } = await session(mock);
    const result = await underFakeTime(run());
    expect(result.end).toBe('acknowledged');
    expect(result.framesSent).toBe(RT95_GOLDEN_FRAMES + 2 + 2);
    expect(mock.image(0x08002000, FILES.cdd.length)).toEqual(FILES.cdd);
    // The silent frame cost its 3 s timeout before the resend.
    expect(result.timing!.maxFrameMs).toBeGreaterThanOrEqual(3000);
  });

  it('stops after a frame stays silent four times: radio touched, no end byte', async () => {
    const mock = new Rt95BootloaderMock({ silentAt: [5, 6, 7, 8] });
    const { run } = await session(mock);
    const err = await flashError(underFakeTime(run()));
    // The last silence surfaces as the updater's "did not accept" protocol error, not the read timeout.
    expect(err.code).toBe('protocol');
    expect(err.message).toMatch(/after 4 attempts \(last reply nothing\)/);
    expect(err.radioTouched).toBe(true);
    expect(err.position).toMatch(/^frame 5\//);
    expect(mock.log).not.toContain('end');
    expect(mock.frames).toBe(8);
  });

  it('stops when the cable is pulled mid-transfer: closed, radio touched, nothing more sent', async () => {
    // Write 1 is PROGRAM; write 41 is data frame 40.
    const mock = new Rt95BootloaderMock();
    const { run, record } = await session(mock, { cutAfterWrites: 41 });
    const err = await flashError(underFakeTime(run()));
    expect(err.code).toBe('closed');
    expect(err.radioTouched).toBe(true);
    expect(err.position).toMatch(/^frame 40\//);
    expect(record.cut).toBe(true);
    expect(mock.frames).toBe(40);
    expect(mock.log).not.toContain('end');
  });

  it('holds its timeouts with a phone-like delay on every event', async () => {
    const mock = new Rt95BootloaderMock();
    const { run, record } = await session(mock, { eventDelayMs: 10 });
    const result = await underFakeTime(run());
    expect(result).toMatchObject({ framesSent: RT95_GOLDEN_FRAMES + 2, end: 'acknowledged' });
    expect(mock.image(0x08002000, FILES.cdd.length)).toEqual(FILES.cdd);
    // Seventeen 64-byte events of echo plus the ACK, 10 ms each: about 180 ms a frame, far inside 3 s.
    expect(result.timing!.medianFrameMs).toBeGreaterThanOrEqual(170);
    expect(result.timing!.maxFrameMs).toBeLessThan(3000);
    expect(record.events).toBeGreaterThan(RT95_GOLDEN_FRAMES * 16);
  });
});
