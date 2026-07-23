import { afterEach, describe, expect, it, vi } from 'vitest';
import { RadioClosedError, RadioTimeoutError, RadioUnsupportedError } from '../kit/errors.ts';
import {
  assertWebSerialSupported,
  getWebSerialUnsupportedMessage,
  isWebSerialSupported,
} from './featureDetect.ts';
import { createFakeSerialPort } from './fakeSerialPort.ts';
import {
  openWebSerialPipe,
  requestWebSerialPipe,
  WEB_SERIAL_HOST_BUFFER_SIZE,
} from './webSerialPipe.ts';

describe('featureDetect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported when navigator.serial is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(isWebSerialSupported()).toBe(false);
    expect(getWebSerialUnsupportedMessage()).toMatch(/Chrome or Edge/i);
    expect(() => assertWebSerialSupported()).toThrow(RadioUnsupportedError);
  });

  it('reports supported when navigator.serial is present', () => {
    vi.stubGlobal('navigator', {
      serial: { getPorts: async () => [], requestPort: async () => ({}) },
    });
    expect(isWebSerialSupported()).toBe(true);
    expect(() => assertWebSerialSupported()).not.toThrow();
  });
});

describe('openWebSerialPipe', () => {
  it('readExact reassembles across chunk boundaries', async () => {
    const fake = createFakeSerialPort();
    const pipe = await openWebSerialPipe(fake.port, 38400);

    const readPromise = pipe.readExact(5, 2000);
    await Promise.resolve();
    fake.pushRead(new Uint8Array([1, 2]));
    await Promise.resolve();
    fake.pushRead(new Uint8Array([3, 4, 5, 6]));

    await expect(readPromise).resolves.toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    // leftover byte stays buffered for next read
    const next = pipe.readExact(1, 500);
    await expect(next).resolves.toEqual(new Uint8Array([6]));
    await pipe.close();
  });

  it('readExact completes a 4KB-class payload delivered in many small chunks', async () => {
    // Regression: waiters must park when buf has a partial chunk; busy-spinning
    // starves the pump and stalls DM-32 4KB block replies (#663).
    const fake = createFakeSerialPort();
    const pipe = await openWebSerialPipe(fake.port, 115200);
    const total = 4102; // 6-byte R/W header + 4096 data
    const readPromise = pipe.readExact(total, 5000);

    const chunk = 64;
    for (let offset = 0; offset < total; offset += chunk) {
      const end = Math.min(offset + chunk, total);
      const piece = new Uint8Array(end - offset);
      for (let i = 0; i < piece.length; i++) piece[i] = (offset + i) & 0xff;
      fake.pushRead(piece);
      await new Promise((r) => setTimeout(r, 0));
    }

    const got = await readPromise;
    expect(got).toHaveLength(total);
    expect(got[0]).toBe(0);
    expect(got[total - 1]).toBe((total - 1) & 0xff);
    await pipe.close();
  });

  it('throws RadioTimeoutError when not enough bytes arrive', async () => {
    const fake = createFakeSerialPort();
    const pipe = await openWebSerialPipe(fake.port, 9600);
    fake.pushRead(new Uint8Array([0xaa]));

    await expect(pipe.readExact(4, 80)).rejects.toBeInstanceOf(RadioTimeoutError);
    await pipe.close();
  });

  it('throws RadioClosedError when readable ends mid-read', async () => {
    const fake = createFakeSerialPort();
    const pipe = await openWebSerialPipe(fake.port, 9600);

    const readPromise = pipe.readExact(4, 2000);
    await Promise.resolve();
    fake.pushRead(new Uint8Array([1]));
    await Promise.resolve();
    fake.endRead();

    await expect(readPromise).rejects.toBeInstanceOf(RadioClosedError);
    await pipe.close();
  });

  it('write records bytes on the fake writable', async () => {
    const fake = createFakeSerialPort();
    const pipe = await openWebSerialPipe(fake.port, 115200);
    await pipe.write(new Uint8Array([0x52, 0x00, 0x10, 0x40]));
    expect(fake.writtenBytes()).toEqual(new Uint8Array([0x52, 0x00, 0x10, 0x40]));
    await pipe.close();
  });

  it('flush clears the internal read buffer', async () => {
    const fake = createFakeSerialPort();
    const pipe = await openWebSerialPipe(fake.port, 38400);
    fake.pushRead(new Uint8Array([9, 8, 7]));
    // drain into buffer
    await pipe.readExact(1, 500);
    expect(pipe.flush).toBeTypeOf('function');
    await pipe.flush!();
    // after flush, leftover must not be returned
    const late = pipe.readExact(2, 60);
    await expect(late).rejects.toBeInstanceOf(RadioTimeoutError);
    await pipe.close();
  });

  it('opens a closed port via port.open before attaching', async () => {
    const fake = createFakeSerialPort({ initiallyOpen: false });
    const openSpy = vi.spyOn(fake.port, 'open');
    const pipe = await openWebSerialPipe(fake.port, 38400);
    expect(openSpy).toHaveBeenCalledWith({
      baudRate: 38400,
      bufferSize: WEB_SERIAL_HOST_BUFFER_SIZE,
    });
    await pipe.write(new Uint8Array([1]));
    expect(fake.writtenBytes()).toEqual(new Uint8Array([1]));
    await pipe.close();
  });
});

describe('requestWebSerialPipe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses getPorts first when forceSelection is false', async () => {
    const fake = createFakeSerialPort();
    const requestPort = vi.fn();
    const getPorts = vi.fn(async () => [fake.port]);
    vi.stubGlobal('navigator', { serial: { getPorts, requestPort } });

    const pipe = await requestWebSerialPipe({ baudRate: 38400 });
    expect(getPorts).toHaveBeenCalled();
    expect(requestPort).not.toHaveBeenCalled();
    await pipe.close();
  });

  it('calls requestPort when forceSelection is true', async () => {
    const fake = createFakeSerialPort();
    const requestPort = vi.fn(async () => fake.port);
    const getPorts = vi.fn(async () => [fake.port]);
    vi.stubGlobal('navigator', { serial: { getPorts, requestPort } });

    const pipe = await requestWebSerialPipe({ baudRate: 38400, forceSelection: true });
    expect(requestPort).toHaveBeenCalled();
    await pipe.close();
  });
});
