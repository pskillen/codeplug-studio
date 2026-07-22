/**
 * Controllable fake SerialPort for BytePipe unit tests.
 */

import type { SerialPortLike } from './webSerialPipe.ts';

export interface FakeSerialController {
  port: SerialPortLike;
  /** Push bytes into the readable side. */
  pushRead(data: Uint8Array): void;
  /** Close the readable side (simulates cable unplug / port close). */
  endRead(): void;
  /** Bytes written by the pipe so far. */
  written: Uint8Array[];
  /** Concatenate all written chunks. */
  writtenBytes(): Uint8Array;
}

export function createFakeSerialPort(options?: {
  /** Start with streams already "open" (default true). */
  initiallyOpen?: boolean;
}): FakeSerialController {
  const initiallyOpen = options?.initiallyOpen ?? true;
  const written: Uint8Array[] = [];
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      written.push(chunk.slice());
    },
  });

  let openReadable: ReadableStream<Uint8Array> | null = initiallyOpen ? readable : null;
  let openWritable: WritableStream<Uint8Array> | null = initiallyOpen ? writable : null;

  const port: SerialPortLike = {
    get readable() {
      return openReadable;
    },
    get writable() {
      return openWritable;
    },
    async open() {
      openReadable = readable;
      openWritable = writable;
    },
    async close() {
      openReadable = null;
      openWritable = null;
      try {
        controller?.close();
      } catch {
        /* already closed */
      }
    },
  };

  return {
    port,
    written,
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
