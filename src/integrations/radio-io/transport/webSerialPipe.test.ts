import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RadioClosedError,
  RadioProtocolError,
  RadioTimeoutError,
  RadioUnsupportedError,
} from '../kit/errors.ts';
import {
  assertWebSerialSupported,
  getWebSerialUnsupportedMessage,
  isWebSerialSupported,
} from './featureDetect.ts';
import { createFakeSerialPort } from './fakeSerialPort.ts';
import {
  openWebSerialPipe,
  requestWebSerialPipe,
  requestWebSerialPort,
  WEB_SERIAL_HOST_BUFFER_SIZE,
  type SerialPortLike,
  type WebSerialPipe,
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

describe('openWebSerialPipe write guard (no frame straddles the host buffer boundary)', () => {
  const B = WEB_SERIAL_HOST_BUFFER_SIZE;
  const frame = (n: number, fill = 1): Uint8Array => new Uint8Array(n).fill(fill);

  it('opens at 1 MiB', () => {
    expect(WEB_SERIAL_HOST_BUFFER_SIZE).toBe(1_048_576);
  });

  it('rotates the writable before a frame that would straddle the boundary and writes it whole', async () => {
    const fake = createFakeSerialPort();
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    await pipe.write(frame(B - 10, 1));
    await pipe.write(frame(10, 2)); // ends exactly on the boundary: no rotation yet
    expect(pipe.writerRotations).toBe(0);
    expect(pipe.streamBytesWritten).toBe(B);
    await pipe.write(frame(4, 3)); // starts exactly at the boundary (offset 0 of the ring): fits
    expect(pipe.writerRotations).toBe(0);
    await pipe.write(frame(B - 8, 4)); // 4 + (B-8) = B-4 fits
    await pipe.write(frame(8, 5)); // (B-4) + 8 > B  -> straddles -> rotate
    expect(pipe.writerRotations).toBe(1);
    expect(fake.writeStreams).toHaveLength(2);
    const last = fake.writeStreams[1];
    expect(last).toHaveLength(1);
    expect(last[0]).toEqual(frame(8, 5)); // written whole on the new stream
    expect(fake.writeStreams[0].map((c) => c.length)).toEqual([B - 10, 10, 4, B - 8]);
    expect(pipe.streamBytesWritten).toBe(8);
    expect(pipe.txBytesWritten).toBe(B + 4 + (B - 8) + 8);
    await pipe.close();
  });

  it('does not rotate for frames that stay within the boundary, and counts reset after a rotation', async () => {
    const fake = createFakeSerialPort();
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    for (let i = 0; i < 100; i++) await pipe.write(frame(1000, i & 0xff));
    expect(pipe.writerRotations).toBe(0);
    expect(fake.writeStreams).toHaveLength(1);
    expect(pipe.txBytesWritten).toBe(100_000);

    await pipe.write(frame(B - 100_000 + 1)); // straddles
    expect(pipe.writerRotations).toBe(1);
    expect(pipe.streamBytesWritten).toBe(B - 100_000 + 1);
    // further small writes go to the new stream, no more rotations
    await pipe.write(frame(5));
    expect(pipe.writerRotations).toBe(1);
    expect(fake.writeStreams[1].map((c) => c.length)).toEqual([B - 100_000 + 1, 5]);
    await pipe.close();
  });

  it('keeps the byte order intact across rotations', async () => {
    const fake = createFakeSerialPort();
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    // 70 KiB frames: 15 writes cross the 1 MiB boundary once
    for (let i = 0; i < 16; i++) {
      const f = frame(70 * 1024, i + 1);
      await pipe.write(f);
    }
    expect(pipe.writerRotations).toBe(1);
    const got = fake.writtenBytes();
    expect(got).toHaveLength(16 * 70 * 1024);
    for (let i = 0; i < 16; i++) expect(got[i * 70 * 1024]).toBe(i + 1);
    await pipe.close();
  });

  it('throws a clear error for a frame larger than the buffer, writing nothing', async () => {
    const fake = createFakeSerialPort();
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    await expect(pipe.write(frame(B + 1))).rejects.toBeInstanceOf(RadioProtocolError);
    await expect(pipe.write(frame(B + 1))).rejects.toThrow(/exceeds the 1048576-byte write buffer/);
    expect(fake.written).toHaveLength(0);
    await pipe.write(frame(3)); // pipe still usable
    expect(fake.written).toHaveLength(1);
    await pipe.close();
  });

  it('a frame of exactly bufferSize fits on a fresh stream and rotates on the next', async () => {
    const fake = createFakeSerialPort();
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    await pipe.write(frame(B));
    expect(pipe.writerRotations).toBe(0);
    await pipe.write(frame(1));
    expect(pipe.writerRotations).toBe(0); // offset B % B = 0, 0 + 1 fits
    await pipe.write(frame(B));
    expect(pipe.writerRotations).toBe(1);
    await pipe.close();
  });

  it('serialises concurrent writes so a rotation cannot interleave', async () => {
    const fake = createFakeSerialPort();
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    await pipe.write(frame(B - 1));
    await Promise.all([pipe.write(frame(2, 7)), pipe.write(frame(3, 8)), pipe.write(frame(4, 9))]);
    expect(fake.writeStreams[1].map((c) => [c.length, c[0]])).toEqual([
      [2, 7],
      [3, 8],
      [4, 9],
    ]);
    await pipe.close();
  });
});

describe('openWebSerialPipe writer rotation failure modes', () => {
  const B = WEB_SERIAL_HOST_BUFFER_SIZE;

  /** Port whose first writable has a controllable `close`; later `writable` reads hand out fresh streams. */
  function makeRotatingPort(firstClose: () => Promise<void>) {
    const handed: WritableStream<Uint8Array>[] = [];
    let firstClosed = false;
    const first = new WritableStream<Uint8Array>({
      close() {
        firstClosed = true;
        return firstClose();
      },
    });
    handed.push(first);
    const port: SerialPortLike = {
      readable: new ReadableStream<Uint8Array>(),
      get writable() {
        if (!firstClosed) return first;
        const next = new WritableStream<Uint8Array>();
        handed.push(next);
        return next;
      },
      async open() {},
      async close() {},
    };
    return { port, handed };
  }

  it('wraps a failing close of the old writer in a transport error and leaves the pipe closed to writes', async () => {
    const { port } = makeRotatingPort(async () => {
      throw new Error('boom');
    });
    const pipe = await openWebSerialPipe(port, 115200);
    await pipe.write(new Uint8Array(B - 1));
    const err = await pipe.write(new Uint8Array(2)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioClosedError);
    expect((err as Error).message).toMatch(/could not be closed for renewal: boom/);
    await expect(pipe.write(new Uint8Array(1))).rejects.toBeInstanceOf(RadioClosedError);
    await expect(pipe.close()).resolves.toBeUndefined();
  });

  it('close() racing a rotation does not leave a new writer locked', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { port, handed } = makeRotatingPort(() => gate);
    const pipe = await openWebSerialPipe(port, 115200);
    await pipe.write(new Uint8Array(B - 1));
    const rotating = pipe.write(new Uint8Array(2)).catch((e: unknown) => e);
    await new Promise((r) => setTimeout(r, 0)); // rotation is now awaiting the old stream's close
    const closing = pipe.close();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await closing;
    expect(await rotating).toBeInstanceOf(RadioClosedError);
    expect(handed.every((s) => !s.locked)).toBe(true);
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

  it('calls requestPort with undefined when no filters are given', async () => {
    const fake = createFakeSerialPort();
    const requestPort = vi.fn<(options?: unknown) => Promise<typeof fake.port>>(
      async () => fake.port,
    );
    vi.stubGlobal('navigator', { serial: { getPorts: async () => [], requestPort } });

    await requestWebSerialPort(true);
    expect(requestPort).toHaveBeenCalledWith(undefined);
  });

  it('passes USB filters to requestPort', async () => {
    const fake = createFakeSerialPort();
    const requestPort = vi.fn<(options?: unknown) => Promise<typeof fake.port>>(
      async () => fake.port,
    );
    vi.stubGlobal('navigator', { serial: { getPorts: async () => [], requestPort } });

    const filters = [{ usbVendorId: 0x1234, usbProductId: 0x5678 }];
    await requestWebSerialPort(true, filters);
    expect(requestPort).toHaveBeenCalledWith({ filters });

    const pipe = await requestWebSerialPipe({ baudRate: 9600, forceSelection: true, filters });
    expect(requestPort).toHaveBeenLastCalledWith({ filters });
    await pipe.close();
  });

  it('ignores filters when reusing an already-granted port', async () => {
    const fake = createFakeSerialPort();
    const requestPort = vi.fn();
    vi.stubGlobal('navigator', { serial: { getPorts: async () => [fake.port], requestPort } });

    const port = await requestWebSerialPort(false, [{ usbVendorId: 0x1234 }]);
    expect(port).toBe(fake.port);
    expect(requestPort).not.toHaveBeenCalled();
  });
});

describe('openWebSerialPipe DTR/RTS choice', () => {
  const high = { type: 'setSignals', signals: { dataTerminalReady: true, requestToSend: true } };
  const low = { type: 'setSignals', signals: { dataTerminalReady: false, requestToSend: false } };

  it('raises DTR and RTS right after open by default', async () => {
    const fake = createFakeSerialPort({ initiallyOpen: false });
    const pipe = await openWebSerialPipe(fake.port, 9600);
    expect(fake.calls).toEqual([
      { type: 'open', baudRate: 9600, bufferSize: WEB_SERIAL_HOST_BUFFER_SIZE },
      high,
    ]);
    await pipe.close();
  });

  it('raises them for an explicit raiseDtrRts: true', async () => {
    const fake = createFakeSerialPort({ initiallyOpen: false });
    const pipe = await openWebSerialPipe(fake.port, 9600, { raiseDtrRts: true });
    expect(fake.calls.at(-1)).toEqual(high);
    await pipe.close();
  });

  it('sets both low right after open with raiseDtrRts: false, and never raises them', async () => {
    const fake = createFakeSerialPort({ initiallyOpen: false });
    const pipe = await openWebSerialPipe(fake.port, 9600, { raiseDtrRts: false });
    expect(fake.calls).toEqual([
      { type: 'open', baudRate: 9600, bufferSize: WEB_SERIAL_HOST_BUFFER_SIZE },
      low,
    ]);
    await pipe.close();
  });

  it('tolerates a port whose setSignals rejects', async () => {
    const fake = createFakeSerialPort({ initiallyOpen: false });
    fake.port.setSignals = async () => {
      throw new Error('unsupported');
    };
    const pipe = await openWebSerialPipe(fake.port, 9600, { raiseDtrRts: false });
    await pipe.close();
  });
});
