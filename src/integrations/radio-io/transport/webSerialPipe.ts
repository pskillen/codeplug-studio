/**
 * Web Serial BytePipe — port request/open, buffered readExact/write/close.
 * No radio handshake or memory layout (architecture §1 / #615).
 *
 * Buffering pattern adapted from NeonPlug BaseSerialConnection (cite only).
 */

import type { BytePipe } from '../types.ts';
import { RadioClosedError, RadioTimeoutError, RadioUnsupportedError } from '../kit/errors.ts';
import { assertWebSerialSupported } from './featureDetect.ts';

export interface WebSerialPipeOptions {
  baudRate: number;
  /** When true, always show the browser port picker (ignore getPorts cache). */
  forceSelection?: boolean;
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
 * Web Serial default `bufferSize` is 255 — far too small for DM-32UV 4KB block
 * replies (and stressful on macOS CDC). Open with a larger host-side buffer so
 * the OS→browser queue can absorb a full R/W frame without dropping / stalling
 * the radio (see WICG/serial#164, MDN SerialPort.open).
 */
export const WEB_SERIAL_HOST_BUFFER_SIZE = 65_536;

class WebSerialBytePipe implements BytePipe {
  readonly baudRate: number;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buf = new Uint8Array(0);
  private port: SerialPortLike | null = null;
  private closed = false;
  private eof = false;
  private pumpPromise: Promise<void> | null = null;
  private waiters: Array<() => void> = [];

  constructor(baudRate: number) {
    this.baudRate = baudRate;
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
    this.pumpPromise = this.pump();
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    await this.writer.write(data);
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

async function resolvePort(forceSelection: boolean): Promise<SerialPortLike> {
  assertWebSerialSupported();
  const serial = navigator.serial;
  if (!serial) {
    throw new RadioUnsupportedError();
  }
  if (forceSelection) {
    return serial.requestPort();
  }
  const existing = await serial.getPorts();
  return existing[0] ?? (await serial.requestPort());
}

/** Request (or reuse) a Web Serial port without opening it. */
export async function requestWebSerialPort(forceSelection = false): Promise<SerialPortLike> {
  return resolvePort(forceSelection);
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
  const pipe = new WebSerialBytePipe(baudRate);
  await pipe.attach(port);
  return pipe;
}

/**
 * Request (or reuse) a Web Serial port and open a BytePipe at `baudRate`.
 */
export async function requestWebSerialPipe(options: WebSerialPipeOptions): Promise<BytePipe> {
  const port = await requestWebSerialPort(options.forceSelection ?? false);
  return openWebSerialPipe(port, options.baudRate);
}
