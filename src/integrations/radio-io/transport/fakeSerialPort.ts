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
  /** Bytes written by the pipe so far (every chunk, all writable streams, in order). */
  written: Uint8Array[];
  /**
   * Chunks per writable stream instance, in creation order. Like a real SerialPort, a new stream appears (from the
   * `writable` getter) after the previous one is closed while the port stays open.
   */
  writeStreams: Uint8Array[][];
  /** Concatenate all written chunks. */
  writtenBytes(): Uint8Array;
}

export function createFakeSerialPort(options?: {
  /** Start with streams already "open" (default true). */
  initiallyOpen?: boolean;
  /**
   * Called synchronously for every chunk the pipe writes (any writable stream). Lets a test play an auto-replying
   * radio by calling `pushRead` from inside.
   */
  onWrite?: (chunk: Uint8Array) => void;
}): FakeSerialController {
  const initiallyOpen = options?.initiallyOpen ?? true;
  const onWrite = options?.onWrite;
  const written: Uint8Array[] = [];
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const readable = new ReadableStream<Uint8Array>({
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
      write(chunk) {
        const copy = chunk.slice();
        chunks.push(copy);
        written.push(copy);
        onWrite?.(copy);
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

  let openReadable: ReadableStream<Uint8Array> | null = initiallyOpen ? readable : null;
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
    async open(options?: { baudRate: number; bufferSize?: number }) {
      void options;
      portOpen = true;
      openReadable = readable;
      currentWritable ??= makeWritable();
    },
    async close() {
      portOpen = false;
      openReadable = null;
      currentWritable = null;
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
    writeStreams,
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
