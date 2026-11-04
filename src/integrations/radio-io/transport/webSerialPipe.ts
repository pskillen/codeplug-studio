/**
 * Web Serial BytePipe — port request/open, buffered readExact/write/close.
 * No radio handshake or memory layout (architecture §1 / #615).
 *
 * Buffering pattern adapted from NeonPlug BaseSerialConnection (cite only).
 */

import type { BytePipe } from '../types.ts';
import {
  RadioClosedError,
  RadioProtocolError,
  RadioTimeoutError,
  RadioUnsupportedError,
} from '../kit/errors.ts';
import { assertWebSerialSupported } from './featureDetect.ts';

/** USB vendor / product filter for the Web Serial port picker. */
export type WebSerialPortFilter = SerialPortFilter;

export interface WebSerialPipeOptions {
  baudRate: number;
  /** When true, always show the browser port picker (ignore getPorts cache). */
  forceSelection?: boolean;
  /**
   * Narrow the picker to matching USB devices. Only applies when the picker is shown; an already-granted port
   * reused with `forceSelection: false` ignores it.
   */
  filters?: readonly WebSerialPortFilter[];
}

/**
 * Minimal port surface used by the pipe — real SerialPort or test fakes.
 */
export interface SerialPortLike {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

/**
 * `bufferSize` for `SerialPort.open`. Two reasons it is large:
 *
 * - **Read side.** The Web Serial default is 255 — far too small for DM-32UV 4KB block replies (and stressful on
 *   macOS CDC). A large host-side buffer lets the OS→browser queue absorb a full R/W frame without dropping or
 *   stalling the radio (WICG/serial#164, MDN SerialPort.open). 1 MiB is ample for the largest replies (4 KB).
 * - **Write side.** Chromium backs the writable with a ring of `bufferSize` bytes (a Mojo data pipe). A single
 *   `write` straddling a multiple of that size reaches the OS as two writes, i.e. two USB packets, and native-USB
 *   radios that take each short packet as a whole frame (OpenGD77 CDC) see a corrupt frame. A bigger ring only
 *   makes the boundary rarer; the pipe also guarantees no frame straddles it (see `WebSerialBytePipe.write`).
 */
export const WEB_SERIAL_HOST_BUFFER_SIZE = 1_048_576;

/**
 * What `openWebSerialPipe` actually returns (typed as BytePipe, whose optional `txBytesWritten` is the trace hook);
 * the extra accessors are for tests and diagnostics.
 */
export interface WebSerialPipe extends BytePipe {
  /** Cumulative bytes written since the pipe opened (across stream rotations). */
  readonly txBytesWritten: number;
  /** Bytes written on the current writable stream (0 right after a rotation); the ring position modulo bufferSize. */
  readonly streamBytesWritten: number;
  /** How many times the writable stream was renewed to keep a frame off the ring boundary. */
  readonly writerRotations: number;
}

class WebSerialBytePipe implements WebSerialPipe {
  readonly baudRate: number;
  txBytesWritten = 0;
  streamBytesWritten = 0;
  writerRotations = 0;
  private readonly bufferSize: number;
  private writeChain: Promise<void> = Promise.resolve();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buf = new Uint8Array(0);
  private port: SerialPortLike | null = null;
  private closed = false;
  private eof = false;
  private pumpPromise: Promise<void> | null = null;
  private waiters: Array<() => void> = [];

  constructor(baudRate: number, bufferSize: number) {
    this.baudRate = baudRate;
    this.bufferSize = bufferSize;
  }

  async attach(port: SerialPortLike): Promise<void> {
    this.port = port;
    this.buf = new Uint8Array(0);
    this.closed = false;
    this.eof = false;
    if (!port.readable || !port.writable) {
      throw new RadioClosedError('Port streams unavailable.');
    }
    if (port.readable.locked || port.writable.locked) {
      throw new RadioClosedError(
        'Serial port is busy from a previous operation. Reconnect the cable or reload the page.',
      );
    }
    this.reader = port.readable.getReader();
    this.writer = port.writable.getWriter();
    this.txBytesWritten = 0;
    this.streamBytesWritten = 0;
    this.writerRotations = 0;
    this.pumpPromise = this.pump();
  }

  /**
   * Write one frame, never letting it straddle a `bufferSize` boundary of the current writable stream.
   *
   * If it would, the stream is closed (flushing everything before it) and a fresh one taken from `port.writable`:
   * a new stream has a new ring starting at offset 0, and the port, DTR/RTS and the reader are untouched
   * (WICG Serial "handle closing the writable stream"; Chromium `SerialPort::writable` builds a new data pipe).
   * Calls are serialised, so concurrent writes cannot interleave a rotation.
   */
  write(data: Uint8Array): Promise<void> {
    const run = this.writeChain.then(() => this.writeFrame(data));
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async writeFrame(data: Uint8Array): Promise<void> {
    if (!this.writer || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    if (data.length > this.bufferSize) {
      throw new RadioProtocolError(
        `Serial frame of ${data.length} bytes exceeds the ${this.bufferSize}-byte write buffer; it cannot be kept off the buffer boundary. Split it into smaller frames.`,
      );
    }
    if ((this.streamBytesWritten % this.bufferSize) + data.length > this.bufferSize) {
      await this.rotateWriter();
    }
    await this.writer.write(data);
    this.streamBytesWritten += data.length;
    this.txBytesWritten += data.length;
  }

  private async rotateWriter(): Promise<void> {
    const old = this.writer;
    const port = this.port;
    if (!old || !port) {
      throw new RadioClosedError('Not connected.');
    }
    await old.close();
    try {
      old.releaseLock();
    } catch {
      /* already released */
    }
    const next = port.writable;
    if (!next) {
      this.writer = null;
      throw new RadioClosedError('Serial port write stream could not be renewed.');
    }
    this.writer = next.getWriter();
    this.streamBytesWritten = 0;
    this.writerRotations += 1;
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    if ((!this.reader && !this.eof) || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    if (n < 0) {
      throw new RangeError(`readExact length must be >= 0, got ${n}`);
    }
    if (n === 0) {
      return new Uint8Array(0);
    }

    const deadline = Date.now() + timeoutMs;
    while (this.buf.length < n) {
      if (this.eof) {
        throw new RadioClosedError('Serial port closed unexpectedly.');
      }
      if (Date.now() > deadline) {
        throw new RadioTimeoutError(`Timeout: needed ${n} bytes, have ${this.buf.length}.`);
      }
      const remaining = Math.max(1, deadline - Date.now());
      // Park until the buffer grows (or timeout/eof). Must not busy-spin when
      // buf already has a partial chunk — that starves the continuous pump and
      // stalls 4KB DM-32 replies (radio exits PC Program / reboots).
      await this.waitForBufferGrowth(this.buf.length, remaining);
    }

    const result = this.buf.slice(0, n);
    this.buf = this.buf.length > n ? this.buf.slice(n) : new Uint8Array(0);
    return result;
  }

  async flush(): Promise<void> {
    this.buf = new Uint8Array(0);
  }

  async drain(): Promise<Uint8Array> {
    const pending = this.buf;
    this.buf = new Uint8Array(0);
    return pending;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.notifyWaiters();
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      await this.writer?.close();
    } catch {
      /* ignore */
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch {
        /* ignore */
      }
    }
    try {
      await this.pumpPromise;
    } catch {
      /* ignore */
    }
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.buf = new Uint8Array(0);
  }

  private async pump(): Promise<void> {
    const reader = this.reader;
    if (!reader) {
      return;
    }
    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) {
          this.eof = true;
          this.notifyWaiters();
          return;
        }
        if (value && value.length > 0) {
          const next = new Uint8Array(this.buf.length + value.length);
          next.set(this.buf);
          next.set(value, this.buf.length);
          this.buf = next;
          this.notifyWaiters();
        }
      }
    } catch {
      this.eof = true;
      this.notifyWaiters();
    }
  }

  /**
   * Wait until `buf.length` exceeds `priorLength`, or eof/closed/timeout.
   * Lost-wakeup safe: re-check after registering the waiter.
   */
  private waitForBufferGrowth(priorLength: number, timeoutMs: number): Promise<void> {
    if (this.buf.length > priorLength || this.eof || this.closed) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(onNotify);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
        }
        resolve();
      }, timeoutMs);
      const onNotify = (): void => {
        clearTimeout(timer);
        const idx = this.waiters.indexOf(onNotify);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
        }
        resolve();
      };
      this.waiters.push(onNotify);
      // Data may have arrived between the length check and registration.
      if (this.buf.length > priorLength || this.eof || this.closed) {
        onNotify();
      }
    });
  }

  private notifyWaiters(): void {
    const pending = this.waiters.splice(0, this.waiters.length);
    for (const w of pending) {
      w();
    }
  }
}

async function resolvePort(
  forceSelection: boolean,
  filters?: readonly WebSerialPortFilter[],
): Promise<SerialPortLike> {
  assertWebSerialSupported();
  const serial = navigator.serial;
  if (!serial) {
    throw new RadioUnsupportedError();
  }
  const requestOptions = filters?.length ? { filters: [...filters] } : undefined;
  if (forceSelection) {
    return serial.requestPort(requestOptions);
  }
  const existing = await serial.getPorts();
  return existing[0] ?? (await serial.requestPort(requestOptions));
}

/** Request (or reuse) a Web Serial port without opening it. `filters` narrow the picker when it is shown. */
export async function requestWebSerialPort(
  forceSelection = false,
  filters?: readonly WebSerialPortFilter[],
): Promise<SerialPortLike> {
  return resolvePort(forceSelection, filters);
}

async function assertSerialSignals(port: SerialPortLike): Promise<void> {
  try {
    await port.setSignals?.({ dataTerminalReady: true, requestToSend: true });
  } catch {
    /* RTS/DTR unsupported or rejected — best effort (CHIRP WANTS_RTS/DTR). */
  }
}

/**
 * Open an already-obtained port at `baudRate` and return a BytePipe.
 *
 * The write guard assumes the port was opened with `WEB_SERIAL_HOST_BUFFER_SIZE` (this function does so itself) and
 * that its writable stream is fresh (nothing written yet). Ports opened elsewhere must use the same `bufferSize`.
 */
export async function openWebSerialPipe(port: SerialPortLike, baudRate: number): Promise<BytePipe> {
  if (!port.readable || !port.writable) {
    await port.open({ baudRate, bufferSize: WEB_SERIAL_HOST_BUFFER_SIZE });
    await assertSerialSignals(port);
  } else if (port.readable.locked || port.writable.locked) {
    throw new RadioClosedError(
      'Serial port is busy from a previous operation. Reconnect the cable or reload the page.',
    );
  }
  const pipe = new WebSerialBytePipe(baudRate, WEB_SERIAL_HOST_BUFFER_SIZE);
  await pipe.attach(port);
  return pipe;
}

/**
 * Request (or reuse) a Web Serial port and open a BytePipe at `baudRate`.
 */
export async function requestWebSerialPipe(options: WebSerialPipeOptions): Promise<BytePipe> {
  const port = await requestWebSerialPort(options.forceSelection ?? false, options.filters);
  return openWebSerialPipe(port, options.baudRate);
}
