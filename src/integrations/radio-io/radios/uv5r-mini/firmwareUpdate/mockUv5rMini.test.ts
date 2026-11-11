import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  encodeUv5rMiniFrame,
  Uv5rMiniFrameParser,
  UV5RMINI_FW_CMD,
  uv5rMiniU32,
} from './frames.ts';
import { checkUv5rMiniOutgoing } from './outgoing.ts';
import { createUv5rMiniSession, type Uv5rMiniSession } from './session.ts';
import {
  createMockUv5rMini,
  garbleUv5rMiniBytes,
  type MockUv5rMini,
  type Uv5rMiniMockOptions,
} from './__fixtures__/mockUv5rMini.ts';

const { BAUD, PING } = UV5RMINI_FW_CMD;
const DRAIN_MS = 31;

interface Driver {
  session: Uv5rMiniSession;
  /** Advance fake time until `done()` or `maxMs` have passed. */
  until(done: () => boolean, maxMs: number): Promise<void>;
  stop(): Promise<void>;
  error: unknown;
}

/**
 * The smallest possible updater: open at 9600, optionally ping, feed every good frame to the session, check each reply
 * with the outgoing guard, write it, and on `switchTo` close, drain and reopen at the new rate. `holdRate` leaves the
 * link where it is (a host that fails to switch).
 */
function startDriver(
  mock: MockUv5rMini,
  opts: { ping?: boolean; holdRate?: boolean } = {},
): Driver {
  const session = createUv5rMiniSession(mock.image);
  let stopped = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const driver: Driver = {
    session,
    error: undefined,
    async until(done, maxMs) {
      for (let t = 0; t < maxMs && !done(); t += 10) await vi.advanceTimersByTimeAsync(10);
    },
    async stop() {
      stopped = true;
      await reader?.cancel().catch(() => undefined);
    },
  };

  void (async () => {
    await mock.port.open({ baudRate: 9600 });
    reader = mock.port.readable!.getReader();
    let writer = mock.port.writable!.getWriter();
    let parser = new Uv5rMiniFrameParser();
    let linkRate = 9600;
    const send = async (r: { frames: Uint8Array[]; rate: number; switchTo?: number }) => {
      if (!opts.holdRate && r.rate !== linkRate)
        throw new Error(`link at ${linkRate}, reply due at ${r.rate}`);
      for (const f of r.frames) {
        checkUv5rMiniOutgoing(f, session);
        await writer.write(f);
      }
      if (r.switchTo !== undefined && !opts.holdRate) {
        await new Promise((res) => setTimeout(res, DRAIN_MS));
        reader!.releaseLock();
        writer.releaseLock();
        await mock.port.close();
        await mock.port.open({ baudRate: r.switchTo });
        linkRate = r.switchTo;
        reader = mock.port.readable!.getReader();
        writer = mock.port.writable!.getWriter();
        parser = new Uv5rMiniFrameParser();
      }
    };
    if (opts.ping) await send(session.ping());
    while (!session.done && !stopped) {
      const { value, done } = await reader!.read();
      if (done || !value) break;
      for (const e of parser.feed(value)) {
        if (e.kind === 'bad-crc') session.noteBadCrc(e.hex);
        else await send(session.onFrame(e.cmd, e.data));
      }
    }
  })().catch((e: unknown) => {
    driver.error = e;
  });
  return driver;
}

let mock: MockUv5rMini | undefined;
const make = (o: Uv5rMiniMockOptions = {}) => (mock = createMockUv5rMini(o));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  mock?.dispose();
  mock = undefined;
  vi.useRealTimers();
});

describe('mock UV-5R Mini: a clean run', () => {
  it('ends 0x00 in the loader with the area length the mock announced, every frame guarded and heard', async () => {
    const m = make();
    const d = startDriver(m, { ping: true });
    await d.until(() => d.session.done, 5_000);
    expect(d.error).toBeUndefined();
    const s = d.session;
    expect(s.result).toBe(0);
    expect(s.resultPhase).toBe('loader');
    expect(s.continued).toBe(false);
    expect(s.areaLength).toBe(m.areaLength);
    expect(m.state).toBe('finished');
    expect(m.areaReads).toBe(8);
    expect(m.badReplies).toBe(0);
    expect(m.loaderResets).toBe(0);
    // 8 app reads + 9 loader reads + the area.
    expect(s.reads).toBe(8 + 9 + 8);
    // Everything the host sent was a frame it may send, and the radio heard all of it.
    expect(m.hostFrames.every((f) => f.heard)).toBe(true);
    expect(m.hostFrames.every((f) => [1, 2, 3, 4, 6].includes(f.cmd))).toBe(true);
    // The loader's cmd 3 and cmd 4 were echoed; the app stage was started with no echo, at 9600.
    expect(m.hostFrames.filter((f) => f.cmd === 3).map((f) => Array.from(f.data))).toEqual([[0]]);
    expect(m.hostFrames.filter((f) => f.cmd === 4)).toHaveLength(1);
    expect(m.hostFrames[0]).toMatchObject({ cmd: PING, rate: 9600 });
    expect(Array.from(m.hostFrames[1]!.data)).toEqual(Array.from(uv5rMiniU32(9600)));
    // The switch: the host's reply to the app's hand-over went out at 9600, everything after at 38400.
    const firstFast = m.hostFrames.findIndex((f) => f.rate === 38400);
    expect(m.hostFrames[firstFast - 1]).toMatchObject({ cmd: BAUD, rate: 9600 });
    expect(m.hostFrames.slice(firstFast).every((f) => f.rate === 38400)).toBe(true);
    await d.stop();
  });
});

describe('mock UV-5R Mini: faults', () => {
  it('a power cut mid-area stalls the session; a restart from the record is recognised in listen and finishes', async () => {
    const m = make({ cutAfterAreaReads: 3 });
    const d = startDriver(m, { ping: true });
    await d.until(() => m.state === 'cut', 5_000);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(m.state).toBe('cut');
    expect(m.areaReads).toBe(3);
    expect(d.session.done).toBe(false);
    expect(d.session.phase).toBe('loader');
    expect(d.session.areaLength).toBe(m.areaLength);
    expect(d.session.result).toBeUndefined();
    await d.stop();

    // Power back: the loader restarts from its record at 9600 and talks first.
    await m.port.close();
    const d2 = startDriver(m);
    await vi.advanceTimersByTimeAsync(0);
    m.powerOn();
    expect(m.recordKept).toBe(true);
    await d2.until(() => d2.session.done, 5_000);
    expect(d2.error).toBeUndefined();
    expect(d2.session.continued).toBe(true);
    expect(d2.session.events[0]).toMatchObject({ kind: 'loader-first', rate: 9600 });
    expect(d2.session.result).toBe(0);
    expect(d2.session.areaLength).toBe(m.areaLength);
  });

  it('restartFromRecord: starts in the loader at 9600, talking first; the host never pings', async () => {
    const m = make({ restartFromRecord: true });
    expect(m.state).toBe('off');
    const d = startDriver(m);
    await vi.advanceTimersByTimeAsync(0);
    expect(d.session.phase).toBe('listen');
    m.powerOn();
    await d.until(() => d.session.done, 5_000);
    expect(d.error).toBeUndefined();
    expect(d.session.continued).toBe(true);
    expect(d.session.events[0]).toMatchObject({ kind: 'loader-first' });
    expect(d.session.result).toBe(0);
    expect(m.hostFrames.some((f) => f.cmd === PING)).toBe(false);
  });

  it('a loader refusal before cmd 4 ends 0x86 in the loader with no area length', async () => {
    const m = make({ loaderRefuses: 0x86 });
    const d = startDriver(m, { ping: true });
    await d.until(() => d.session.done, 5_000);
    expect(d.error).toBeUndefined();
    expect(d.session.result).toBe(0x86);
    expect(d.session.resultPhase).toBe('loader');
    expect(d.session.areaLength).toBeUndefined();
    expect(m.areaReads).toBe(0);
    expect(m.hostFrames.some((f) => f.cmd === 4)).toBe(false);
    expect(m.hostFrames.at(-1)).toMatchObject({ cmd: 3 }); // echoed
  });

  it('an app result ends the session in the app phase and is not echoed', async () => {
    const m = make({ appResult: 0x8a });
    const d = startDriver(m, { ping: true });
    await d.until(() => d.session.done, 5_000);
    expect(d.error).toBeUndefined();
    expect(d.session.result).toBe(0x8a);
    expect(d.session.resultPhase).toBe('app');
    expect(m.hostFrames.some((f) => f.cmd === 3)).toBe(false);
    expect(m.state).toBe('finished');
    expect(m.loaderResets).toBe(0);
  });

  it('ignorePing: the session stays in ping', async () => {
    const m = make({ ignorePing: true });
    const d = startDriver(m, { ping: true });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(d.session.phase).toBe('ping');
    expect(m.radioFrames).toHaveLength(0);
    await d.stop();
  });
});

describe('mock UV-5R Mini: rates', () => {
  it('a host that does not switch hears garbage, and the loader gives up after its budget and restarts talking first', async () => {
    const m = make();
    const d = startDriver(m, { ping: true, holdRate: true });
    await d.until(() => m.loaderResets === 1, 10_000);
    expect(d.error).toBeUndefined();
    const fast = m.radioFrames.filter((f) => f.rate === 38400);
    expect(fast.length).toBe(7); // 0, 100 ... 600 ms after the first; given up at 700
    expect(fast.every((f) => !f.heard)).toBe(true);
    expect(m.loaderResets).toBe(1);
    expect(m.recordKept).toBe(true);
    // The restart talks first at 9600, which this host (still at 9600) can hear.
    await vi.advanceTimersByTimeAsync(600);
    const last = m.radioFrames.at(-1)!;
    expect(last).toMatchObject({ cmd: BAUD, rate: 9600, heard: true });
    await d.stop();
  });

  it('bytes the radio sends at another rate are the same length and never parse', async () => {
    const m = make();
    await m.port.open({ baudRate: 38400 }); // the radio is at 9600
    const reader = m.port.readable!.getReader();
    const writer = m.port.writable!.getWriter();
    await writer.write(encodeUv5rMiniFrame(PING));
    expect(m.hostFrames[0]).toMatchObject({ cmd: PING, rate: 38400, heard: false });
    expect(m.radioFrames).toHaveLength(0); // it did not hear the ping, so it did not answer

    // Now at the right rate the ping is answered; read the pong at the wrong rate by faking the host's listening rate.
    reader.releaseLock();
    writer.releaseLock();
    await m.port.close();
    await m.port.open({ baudRate: 9600 });
    const r2 = m.port.readable!.getReader();
    await m.port.writable!.getWriter().write(encodeUv5rMiniFrame(PING));
    const got = await r2.read();
    expect(new Uv5rMiniFrameParser().feed(got.value!)).toEqual([
      { kind: 'frame', cmd: BAUD, data: new Uint8Array(0) },
    ]);

    const frame = encodeUv5rMiniFrame(BAUD, uv5rMiniU32(38400));
    const garbled = garbleUv5rMiniBytes(frame);
    expect(garbled).toHaveLength(frame.length);
    expect(garbled).toEqual(garbleUv5rMiniBytes(frame)); // deterministic
    expect(new Uv5rMiniFrameParser().feed(garbled).filter((e) => e.kind === 'frame')).toEqual([]);
  });

  it('the guard stops a data reply the image does not have, even when the session produced it', () => {
    const m = make();
    const s = createUv5rMiniSession(m.image);
    s.ping();
    s.onFrame(BAUD, new Uint8Array(0));
    const r = s.onFrame(
      UV5RMINI_FW_CMD.DATA,
      Uint8Array.from([...uv5rMiniU32(m.image.length - 4), ...uv5rMiniU32(0x10)]),
    );
    expect(r.flagged).toBeDefined();
    expect(() => checkUv5rMiniOutgoing(r.frames[0]!, s)).toThrow(RadioInterlockError);
  });
});
