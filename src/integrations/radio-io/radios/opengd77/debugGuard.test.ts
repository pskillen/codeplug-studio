import { describe, expect, it, vi } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioAbortedError } from '../../kit/errors.ts';
import {
  classifyOpenGd77DebugFrame,
  createOpenGd77DebugGuard,
  OpenGd77DebugRefusedError,
} from './debugGuard.ts';

const f = (...bytes: number[]) => new Uint8Array(bytes);
const PING = f(0x43, 0xfe);
const SHOW = f(0x43, 0x00);
const CLOSE = f(0x43, 0x05);
const INFO = f(0x52, 0x09, 0, 0, 0, 0, 0, 0x2e);
const read = (addr: number, len: number) =>
  f(
    0x52,
    0x01,
    (addr >>> 24) & 0xff,
    (addr >>> 16) & 0xff,
    (addr >>> 8) & 0xff,
    addr & 0xff,
    len >> 8,
    len & 0xff,
  );

function spyPipe() {
  const write = vi.fn(async (_data: Uint8Array) => undefined);
  const readExact = vi.fn(async (n: number) => new Uint8Array(n));
  const flush = vi.fn(async () => undefined);
  const drain = vi.fn(async () => new Uint8Array(0));
  const close = vi.fn(async () => undefined);
  const pipe: BytePipe = { write, readExact, flush, drain, close };
  return { pipe, write, readExact, flush, drain, close };
}

/** A guard that has passed ping, FirmwareInfo and show CPS. */
async function inSession(signal?: AbortSignal) {
  const spy = spyPipe();
  const guard = createOpenGd77DebugGuard(spy.pipe, signal);
  await guard.pipe.write(PING);
  await guard.pipe.write(INFO);
  await guard.pipe.write(SHOW);
  spy.write.mockClear();
  return { ...spy, guard };
}

const NEVER_SEND: [string, Uint8Array][] = [
  ['X set sector', f(0x58, 0x01, 0, 0, 0)],
  ['X sector buffer', f(0x58, 0x02, 0, 0, 0, 0, 0, 1, 0xaa)],
  ['X finish', f(0x58, 0x03)],
  ['X eeprom', f(0x58, 0x04, 0, 0, 0, 0, 0, 1, 0xaa)],
  ['bare X', f(0x58)],
  ['W write', f(0x57, 0x01, 0, 0, 0, 0, 0, 1, 0xaa)],
  ['C 06 00 save and reboot', f(0x43, 0x06, 0x00)],
  ['C 06 01 reboot', f(0x43, 0x06, 0x01)],
  ['C 06 02', f(0x43, 0x06, 0x02)],
  ['C 06 04', f(0x43, 0x06, 0x04)],
  ['C 06 other', f(0x43, 0x06, 0x09)],
  ['C 06 bare', f(0x43, 0x06)],
  ['C P', f(0x43, 0x50, 0x01)],
  ['D W', f(0x44, 0x57, 0x01)],
  ['D other', f(0x44, 0x01)],
  ['read mode 10', f(0x52, 0x0a, 0, 0, 0, 0, 0, 0x20)],
  ['read mode 2', f(0x52, 0x02, 0, 0, 0, 0, 0, 0x20)],
  ['read mode 5', f(0x52, 0x05, 0, 0, 0, 0, 0, 0x20)],
  ['read mode 6', f(0x52, 0x06, 0, 0, 0, 0, 0, 0x20)],
  ['read mode 7', f(0x52, 0x07, 0, 0, 0, 0, 0, 0x20)],
  ['read mode 8', f(0x52, 0x08, 0, 0, 0, 0, 0, 0x20)],
  ['read mode 9 at an address', f(0x52, 0x09, 0, 0, 0, 1, 0, 0x2e)],
  ['read mode 9 other length', f(0x52, 0x09, 0, 0, 0, 0, 0, 0x20)],
  ['other C flag', f(0x43, 0x01)],
  ['C 00 with payload', f(0x43, 0x00, 0x00)],
  ['0x24', f(0x24)],
  ['unknown first byte', f(0x99, 0x01)],
  ['empty', f()],
  ['one byte', f(0x43)],
  ['concatenated', new Uint8Array([...PING, ...PING])],
  ['concatenated read and close', new Uint8Array([...read(0x80, 32), ...CLOSE])],
  ['overlong read', new Uint8Array([...read(0x80, 32), 0])],
  ['short read frame', f(0x52, 0x01, 0, 0, 0, 0x80, 0)],
  ['read length 0', read(0x80, 0)],
  ['read length 33', read(0x80, 33)],
  ['read length 0x100', read(0x80, 0x100)],
  ['read past 16 MiB', read(0x0100_0000, 1)],
  ['read straddling 16 MiB', read(0x00ff_ffe1, 32)],
  ['read at the top u32', read(0xffff_ffff, 1)],
];

describe('classifyOpenGd77DebugFrame', () => {
  it.each([
    ['ping', PING],
    ['show-cps', SHOW],
    ['close-cps', CLOSE],
    ['firmware-info', INFO],
    ['flash-read', read(0x80, 32)],
    ['flash-read', read(0, 1)],
    ['flash-read', read(0x00ff_ffe0, 32)],
  ])('allows %s', (kind, frame) => {
    expect(classifyOpenGd77DebugFrame(frame)).toEqual({ allowed: true, kind });
  });

  it.each(NEVER_SEND)('refuses %s', (_name, frame) => {
    const cls = classifyOpenGd77DebugFrame(frame);
    expect(cls.allowed).toBe(false);
  });
});

describe('createOpenGd77DebugGuard', () => {
  it('forwards allowed frames byte for byte, in order', async () => {
    const spy = spyPipe();
    const guard = createOpenGd77DebugGuard(spy.pipe);
    const write = spy.write;
    for (const frame of [PING, INFO, SHOW, read(0x80, 32), CLOSE]) await guard.pipe.write(frame);
    expect(write.mock.calls.map((c) => Array.from(c[0]))).toEqual(
      [PING, INFO, SHOW, read(0x80, 32), CLOSE].map((x) => Array.from(x)),
    );
  });

  it.each(NEVER_SEND)('refuses %s before the transport and latches', async (_name, frame) => {
    const { guard, write } = await inSession();
    await expect(guard.pipe.write(frame)).rejects.toBeInstanceOf(OpenGd77DebugRefusedError);
    expect(write).not.toHaveBeenCalled();
    // Latched: not even a valid read or the CPS close goes.
    await expect(guard.pipe.write(read(0x80, 32))).rejects.toBeInstanceOf(
      OpenGd77DebugRefusedError,
    );
    await expect(guard.pipe.write(CLOSE)).rejects.toBeInstanceOf(OpenGd77DebugRefusedError);
    expect(write).not.toHaveBeenCalled();
    expect(guard.failure()).toBeInstanceOf(OpenGd77DebugRefusedError);
  });

  it('refuses never-send frames before the session has started too', async () => {
    const spy = spyPipe();
    for (const [, frame] of NEVER_SEND) {
      const fresh = createOpenGd77DebugGuard(spy.pipe);
      await expect(fresh.pipe.write(frame)).rejects.toBeInstanceOf(OpenGd77DebugRefusedError);
    }
    expect(spy.write).not.toHaveBeenCalled();
  });

  describe('order', () => {
    it('refuses show CPS before the FirmwareInfo read', async () => {
      const spy = spyPipe();
      const guard = createOpenGd77DebugGuard(spy.pipe);
      await guard.pipe.write(PING);
      await expect(guard.pipe.write(SHOW)).rejects.toBeInstanceOf(OpenGd77DebugRefusedError);
      expect(spy.write).toHaveBeenCalledTimes(1);
    });

    it('refuses a FLASH read before show CPS', async () => {
      const spy = spyPipe();
      const guard = createOpenGd77DebugGuard(spy.pipe);
      await guard.pipe.write(INFO);
      await expect(guard.pipe.write(read(0x80, 32))).rejects.toBeInstanceOf(
        OpenGd77DebugRefusedError,
      );
      expect(spy.write).toHaveBeenCalledTimes(1);
    });

    it('refuses close CPS before show CPS', async () => {
      const spy = spyPipe();
      const guard = createOpenGd77DebugGuard(spy.pipe);
      await guard.pipe.write(INFO);
      await expect(guard.pipe.write(CLOSE)).rejects.toBeInstanceOf(OpenGd77DebugRefusedError);
    });

    it('allows close CPS once, then refuses every frame', async () => {
      const { guard, write } = await inSession();
      await guard.pipe.write(CLOSE);
      expect(write).toHaveBeenCalledTimes(1);
      for (const frame of [CLOSE, PING, INFO, SHOW, read(0x80, 32)]) {
        await expect(guard.pipe.write(frame)).rejects.toBeInstanceOf(OpenGd77DebugRefusedError);
      }
      expect(write).toHaveBeenCalledTimes(1);
    });
  });

  describe('abort', () => {
    it('refuses everything with RadioAbortedError except one close CPS', async () => {
      const controller = new AbortController();
      const { guard, write } = await inSession(controller.signal);
      controller.abort();
      await expect(guard.pipe.write(read(0x80, 32))).rejects.toBeInstanceOf(RadioAbortedError);
      await expect(guard.pipe.write(PING)).rejects.toBeInstanceOf(RadioAbortedError);
      await expect(guard.pipe.write(SHOW)).rejects.toBeInstanceOf(RadioAbortedError);
      expect(write).not.toHaveBeenCalled();
      await guard.pipe.write(CLOSE);
      expect(write).toHaveBeenCalledTimes(1);
      await expect(guard.pipe.write(CLOSE)).rejects.toBeInstanceOf(RadioAbortedError);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('refuses close CPS after abort when show CPS never passed', async () => {
      const controller = new AbortController();
      const spy = spyPipe();
      const guard = createOpenGd77DebugGuard(spy.pipe, controller.signal);
      await guard.pipe.write(INFO);
      controller.abort();
      await expect(guard.pipe.write(CLOSE)).rejects.toBeInstanceOf(RadioAbortedError);
      expect(spy.write).toHaveBeenCalledTimes(1);
    });

    it('does not let a never-send frame through after abort', async () => {
      const controller = new AbortController();
      const { guard, write } = await inSession(controller.signal);
      controller.abort();
      await expect(guard.pipe.write(f(0x58, 0x01, 0, 0, 0))).rejects.toBeInstanceOf(
        RadioAbortedError,
      );
      expect(write).not.toHaveBeenCalled();
    });
  });

  it('passes readExact, flush, drain and close through without sending', async () => {
    const { guard, write, readExact, flush, drain, close } = await inSession();
    await guard.pipe.readExact(3, 100);
    await guard.pipe.flush?.();
    await guard.pipe.drain?.();
    await guard.pipe.close();
    expect(readExact).toHaveBeenCalledWith(3, 100);
    expect(flush).toHaveBeenCalledOnce();
    expect(drain).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it('forwards a copy of the frame, not the caller buffer', async () => {
    const { guard, write } = await inSession();
    const frame = read(0x80, 32);
    await guard.pipe.write(frame);
    const sent = write.mock.calls[0]![0];
    expect(sent).not.toBe(frame);
    expect(Array.from(sent)).toEqual(Array.from(frame));
  });
});
