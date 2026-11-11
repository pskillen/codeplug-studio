/**
 * Web Serial BytePipe — port request/open, buffered readExact/write/close.
 * No radio handshake or memory layout (architecture §1 / #615).
 *
 * Buffering pattern adapted from NeonPlug BaseSerialConnection (cite only).
 *
 * DTR/RTS: `openWebSerialPipe(port, baud, { raiseDtrRts })` sets both lines right after `open()` resolves, high by
 * default (every codeplug caller), low with `false` (a cable may wire them to PTT). The pipe remembers the choice and
 * reapplies it after every `reopen`. It cannot stop what the OS does while opening: Linux asserts DTR/RTS on open
 * (and drops them on the last close), Chromium on Windows enables them while configuring the port with flow control
 * off, macOS is unverified. So the lines can pulse high for the duration of `open()` even with `false`.
 *
 * `reopen(baudRate)`: Web Serial cannot retune an open port. The pipe waits for written bytes to leave the adapter
 * (what is still queued at the old rate, bytes x 10 / rate, + 20 ms, because Chromium's close flushes and discards what
 * is still queued; bytes sent earlier have already left), releases reader and writer, closes the port, opens it at the new rate with the same `bufferSize`,
 * reapplies the signal choice and reattaches with a fresh write ring. Guarantees: queued writes leave first; no byte
 * read before the reopen is delivered after it; `txBytesWritten` stays cumulative. Not guaranteed: how long it takes
 * (adapter and OS dependent: time it with `/debug/serial-reopen`), or that the device sees no gap while the port is
 * closed. A radio that repeats a hello at the new rate for only a short window needs the whole switch well inside it.
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

/** Margin added to the wire time of the written bytes before a reopen (a CH340 FIFO stall fix). */
export const WEB_SERIAL_DRAIN_MARGIN_MS = 20;

/**
 * How long `reopen` waits before closing the port: `bytes × 10 / baudRate` seconds (10 bits per byte on the wire)
 * plus {@link WEB_SERIAL_DRAIN_MARGIN_MS}, rounded up; 0 when nothing was written. Chromium's `close()` discards
 * what the adapter has not sent (tcflush / PurgeComm), and nothing proves the adapter's own FIFO is empty once the
 * writable resolves, so the wait comes first. E.g. 11 bytes at 9600 baud: 32 ms.
 */
export function webSerialDrainMs(bytesWritten: number, baudRate: number): number {
  if (bytesWritten <= 0) {
    return 0;
  }
  return Math.ceil((bytesWritten * 10 * 1000) / baudRate) + WEB_SERIAL_DRAIN_MARGIN_MS;
}

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
  baudRate: number;
  txBytesWritten = 0;
  /** Bytes handed to the writable since the pipe opened or last reopened: what the next reopen must let drain. */
  private bytesSinceDrain = 0;
  /**
   * When (ms, `Date.now()`) the bytes handed over so far will have left the adapter, at the line rate: each write
   * starts when the previous one ends, or now if the line was idle. A long exchange at a slow rate has sent most of
   * its bytes long before a reopen, so the reopen waits for this backlog, not for every byte since the open.
   */
  private wireFreeAt = 0;
  /** Bumped by `reopen`; a pump of an older generation delivers and signals nothing. */
  private generation = 0;
  streamBytesWritten = 0;
  writerRotations = 0;
  private readonly bufferSize: number;
  private readonly raiseDtrRts: boolean;
  private writeChain: Promise<void> = Promise.resolve();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buf = new Uint8Array(0);
  private port: SerialPortLike | null = null;
  private closed = false;
  private eof = false;
  private pumpPromise: Promise<void> | null = null;
  private waiters: Array<() => void> = [];

  constructor(baudRate: number, bufferSize: number, raiseDtrRts: boolean) {
    this.baudRate = baudRate;
    this.bufferSize = bufferSize;
    this.raiseDtrRts = raiseDtrRts;
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
    this.txBytesWritten = 0;
    this.bindStreams(port.readable, port.writable);
  }

  /** Take the reader and writer of a freshly opened port and start the pump (fresh ring, fresh pump generation). */
  private bindStreams(
    readable: ReadableStream<Uint8Array>,
    writable: WritableStream<Uint8Array>,
  ): void {
    this.reader = readable.getReader();
    this.writer = writable.getWriter();
    this.streamBytesWritten = 0;
    this.writerRotations = 0;
    this.bytesSinceDrain = 0;
    this.wireFreeAt = 0;
    this.pumpPromise = this.pump();
  }

  /**
   * Change the line rate. Web Serial cannot retune an open port, so this closes it and opens it again at
   * `baudRate`; see {@link BytePipe.reopen}. Serialised with writes, so queued frames leave first.
   *
   * Order: wait for the written bytes to leave the adapter ({@link webSerialDrainMs}), discard everything read so
   * far, release reader and writer, `close()`, `open({ baudRate, bufferSize })`, reapply the DTR/RTS choice,
   * reattach with a fresh write ring. Bytes read before the reopen are never delivered after it. `txBytesWritten`
   * stays cumulative. A failed close or open leaves the pipe unusable (reads and writes throw `RadioClosedError`);
   * call `close()`.
   */
  reopen(baudRate: number): Promise<void> {
    const run = this.writeChain.then(() => this.reopenNow(baudRate));
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async reopenNow(baudRate: number): Promise<void> {
    const port = this.port;
    if (!port || !this.writer || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    // Only what is still queued on the wire: the backlog's remaining time plus the margin (see `webSerialDrainMs`).
    const drainMs =
      this.bytesSinceDrain > 0
        ? Math.ceil(Math.max(0, this.wireFreeAt - Date.now())) + WEB_SERIAL_DRAIN_MARGIN_MS
        : 0;
    if (drainMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, drainMs));
      if (this.closed) {
        throw new RadioClosedError('Not connected.');
      }
    }

    // From here nothing read on the old stream may reach a reader: the pump of the old generation drops its data.
    this.generation += 1;
    this.buf = new Uint8Array(0);
    this.eof = false;
    const { reader, writer, pumpPromise } = this;
    this.reader = null;
    this.writer = null;
    try {
      await reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      await writer?.close();
    } catch {
      /* ignore */
    }
    for (const lock of [reader, writer]) {
      try {
        lock?.releaseLock();
      } catch {
        /* already released */
      }
    }
    try {
      await pumpPromise;
    } catch {
      /* ignore */
    }
    this.buf = new Uint8Array(0);
    this.eof = false;

    try {
      await port.close();
      await port.open({ baudRate, bufferSize: this.bufferSize });
    } catch (err) {
      throw new RadioClosedError(
        `Serial port could not be reopened at ${baudRate} baud: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await applySerialSignals(port, this.raiseDtrRts);
    if (this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    if (!port.readable || !port.writable) {
      throw new RadioClosedError('Port streams unavailable after reopen.');
    }
    this.baudRate = baudRate;
    this.bindStreams(port.readable, port.writable);
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
    this.bytesSinceDrain += data.length;
    this.wireFreeAt =
      Math.max(this.wireFreeAt, Date.now()) + (data.length * 10 * 1000) / this.baudRate;
  }

  private async rotateWriter(): Promise<void> {
    const old = this.writer;
    const port = this.port;
    if (!old || !port) {
      throw new RadioClosedError('Not connected.');
    }
    try {
      await old.close();
    } catch (err) {
      // The old stream is errored or closed and cannot be renewed reliably: leave a defined state (no writer, so
      // later writes fail with "Not connected." and close() still runs) and report a transport error.
      this.writer = null;
      try {
        old.releaseLock();
      } catch {
        /* already released */
      }
      throw new RadioClosedError(
        `Serial write stream could not be closed for renewal: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      old.releaseLock();
    } catch {
      /* already released */
    }
    if (this.closed) {
      // close() ran while the old stream was flushing: do not take a new writer nobody will release.
      this.writer = null;
      throw new RadioClosedError('Not connected.');
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
    const generation = this.generation;
    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (generation !== this.generation) {
          return;
        }
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
      if (generation !== this.generation) {
        return;
      }
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

/**
 * Set DTR/RTS to the caller's choice right after an open. `raise: false` drives both low (a cable may wire them to
 * PTT); `true` raises both. Best effort: a port or driver without `setSignals` is left as the OS configured it.
 */
async function applySerialSignals(port: SerialPortLike, raise: boolean): Promise<void> {
  try {
    await port.setSignals?.({ dataTerminalReady: raise, requestToSend: raise });
  } catch {
    /* RTS/DTR unsupported or rejected — best effort (CHIRP WANTS_RTS/DTR). */
  }
}

export interface OpenWebSerialPipeOptions {
  /**
   * Raise DTR and RTS after every open (default `true`, as every codeplug caller needs). `false` sets both low
   * instead, for cables that wire them to PTT. The pipe remembers the choice and reapplies it on `reopen`.
   */
  raiseDtrRts?: boolean;
}

/**
 * Open an already-obtained port at `baudRate` and return a BytePipe.
 *
 * The write guard assumes the port was opened with `WEB_SERIAL_HOST_BUFFER_SIZE` (this function does so itself) and
 * that its writable stream is fresh (nothing written yet). Ports opened elsewhere must use the same `bufferSize`.
 *
 * DTR/RTS are set only after `open()` resolves; the pipe cannot stop an OS-level pulse during the open itself.
 */
export async function openWebSerialPipe(
  port: SerialPortLike,
  baudRate: number,
  options?: OpenWebSerialPipeOptions,
): Promise<BytePipe> {
  const raiseDtrRts = options?.raiseDtrRts ?? true;
  if (!port.readable || !port.writable) {
    await port.open({ baudRate, bufferSize: WEB_SERIAL_HOST_BUFFER_SIZE });
    await applySerialSignals(port, raiseDtrRts);
  } else if (port.readable.locked || port.writable.locked) {
    throw new RadioClosedError(
      'Serial port is busy from a previous operation. Reconnect the cable or reload the page.',
    );
  }
  const pipe = new WebSerialBytePipe(baudRate, WEB_SERIAL_HOST_BUFFER_SIZE, raiseDtrRts);
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
