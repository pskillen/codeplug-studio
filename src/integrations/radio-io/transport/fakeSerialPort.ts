/**
 * Controllable fake SerialPort for BytePipe unit tests.
 */

import type { SerialPortLike } from './webSerialPipe.ts';

/** One call the pipe made on the port, in order (`calls`). */
export type FakeSerialCall =
  | { type: 'open'; baudRate: number; bufferSize?: number }
  | { type: 'close' }
  | { type: 'setSignals'; signals: { dataTerminalReady?: boolean; requestToSend?: boolean } };

export interface FakeSerialController {
  port: SerialPortLike;
  /** Push bytes into the readable side (of the current open; a reopen starts a fresh readable). */
  pushRead(data: Uint8Array): void;
  /** Close the readable side (simulates cable unplug / port close). */
  endRead(): void;
  /** Bytes written by the pipe so far (every chunk, all writable streams, in order). */
  written: Uint8Array[];
  /**
   * Chunks per writable stream instance, in creation order. Like a real SerialPort, a new stream appears (from the
   * `writable` getter) after the previous one is closed while the port stays open.
   */
  writeStreams: Uint8Array[][];
  /** `open` / `close` / `setSignals` calls the port received, in order. */
  calls: FakeSerialCall[];
  /** Concatenate all written chunks. */
  writtenBytes(): Uint8Array;
}

export function createFakeSerialPort(options?: {
  /** Start with streams already "open" (default true). */
  initiallyOpen?: boolean;
  /**
   * Called with every chunk the pipe writes, before the write resolves. A radio simulator uses it to feed
   * its replies back through {@link FakeSerialController.pushRead} (the write promise waits for it).
   */
  onWrite?: (chunk: Uint8Array) => void | Promise<void>;
  /**
   * Like a real SerialPort, reject `close()` while the readable or writable is still locked by a reader or
   * writer (default false: the pre-existing pipe `close()` never releases its locks).
   */
  strictLocks?: boolean;
}): FakeSerialController {
  const initiallyOpen = options?.initiallyOpen ?? true;
  const onWrite = options?.onWrite;
  const strictLocks = options?.strictLocks ?? false;
  const written: Uint8Array[] = [];
  const calls: FakeSerialCall[] = [];
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const makeReadable = (): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });

  const writeStreams: Uint8Array[][] = [];
  let portOpen = initiallyOpen;
  let currentWritable: WritableStream<Uint8Array> | null = null;

  const makeWritable = (): WritableStream<Uint8Array> => {
    const chunks: Uint8Array[] = [];
    writeStreams.push(chunks);
    const stream: WritableStream<Uint8Array> = new WritableStream<Uint8Array>({
      async write(chunk) {
        const copy = chunk.slice();
        chunks.push(copy);
        written.push(copy);
        await onWrite?.(copy);
      },
      close() {
        // Spec "handle closing the writable stream": [[writable]] becomes null; the port stays open.
        if (currentWritable === stream) {
          currentWritable = null;
        }
      },
    });
    return stream;
  };

  let openReadable: ReadableStream<Uint8Array> | null = initiallyOpen ? makeReadable() : null;
  if (initiallyOpen) {
    currentWritable = makeWritable();
  }

  const port: SerialPortLike = {
    get readable() {
      return openReadable;
    },
    get writable() {
      if (!portOpen) {
        return null;
      }
      currentWritable ??= makeWritable();
      return currentWritable;
    },
    async open(openOptions: { baudRate: number; bufferSize?: number }) {
      calls.push({ type: 'open', ...openOptions });
      portOpen = true;
      openReadable ??= makeReadable();
      currentWritable ??= makeWritable();
    },
    async close() {
      calls.push({ type: 'close' });
      if (strictLocks && (openReadable?.locked || currentWritable?.locked)) {
        throw new TypeError('InvalidStateError: streams are still locked.');
      }
      portOpen = false;
      openReadable = null;
      currentWritable = null;
      try {
        controller?.close();
      } catch {
        /* already closed */
      }
    },
    async setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }) {
      calls.push({ type: 'setSignals', signals: { ...signals } });
    },
  };

  return {
    port,
    written,
    writeStreams,
    calls,
    pushRead(data: Uint8Array) {
      if (!controller) {
        throw new Error('ReadableStream controller not ready');
      }
      controller.enqueue(data.slice());
    },
    endRead() {
      try {
        controller?.close();
      } catch {
        /* already closed */
      }
    },
    writtenBytes() {
      const total = written.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let o = 0;
      for (const c of written) {
        out.set(c, o);
        o += c.length;
      }
      return out;
    },
  };
}
