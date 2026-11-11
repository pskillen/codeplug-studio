/**
 * Test-only `SerialPortLike` over a localhost TCP socket to the firmware project's emulator serial bridge, which plays
 * a UV-5R Mini (its app, then its loader) on an emulated flash. Used by the env-gated bridge test only; nothing here
 * opens a real serial device.
 *
 * Wire protocol, both ways: `u8 type | u16 LE length | payload`.
 *
 * | Dir | Type | Payload | Meaning                                                                       |
 * | --- | ---- | ------- | ----------------------------------------------------------------------------- |
 * | C>B | 0x01 | bytes   | TX: the host sends these at its current rate                                  |
 * | C>B | 0x02 | u32 LE  | BAUD: the host port is now at this rate (after close and reopen)              |
 * | C>B | 0x03 | u32 LE  | RX: run the radio up to this many emulated ms; answered by 0x81               |
 * | C>B | 0x04 | u32 LE  | CUT: power cut after the loader's nth erase or program in this session; 0 off |
 * | C>B | 0x05 | none    | POWER_ON: switch on with no keys after a cut                                  |
 * | C>B | 0x06 | none    | STATUS: answered by 0x86                                                      |
 * | B>C | 0x81 | bytes   | RXDATA: what the radio sent during that RX (may be empty)                     |
 * | B>C | 0x86 | JSON    | STATUS                                                                        |
 * | B>C | 0xEE | text    | ERROR; the bridge then closes                                                 |
 *
 * Emulated time passes only while the host reads: the readable asks for `BRIDGE_RX_SLICE_MS` of it per pull. A
 * `reopen` is a `close()` plus an `open()` on the same connection, and costs no emulated time while the port is closed.
 */
import { connect, type Socket } from 'node:net';

import type { SerialPortLike } from '../../../../transport/webSerialPipe.ts';

const T = {
  TX: 0x01,
  BAUD: 0x02,
  RX: 0x03,
  CUT: 0x04,
  POWER_ON: 0x05,
  STATUS: 0x06,
  RXDATA: 0x81,
  STATUS_REPLY: 0x86,
  ERROR: 0xee,
} as const;

/** Emulated milliseconds the radio runs for per read request. */
export const BRIDGE_RX_SLICE_MS = 20;

export interface BridgeStatus {
  readonly stage: string;
  readonly result: number | null;
  readonly area: readonly [number, number] | null;
  readonly outside: readonly (readonly [number, number])[];
  readonly flash_sha256: string;
  readonly matches_prediction: boolean | null;
  readonly emulated_s: number;
}

export type BridgeCall =
  | { type: 'open'; baudRate: number; at: number }
  | { type: 'close'; at: number }
  | {
      type: 'setSignals';
      signals: { dataTerminalReady?: boolean; requestToSend?: boolean };
      at: number;
    };

export interface BridgeSerialPort {
  readonly port: SerialPortLike;
  /** Every port call in order, with `Date.now()`. */
  readonly calls: BridgeCall[];
  /** Power cut after the loader's nth erase or program (0 disarms). */
  cut(n: number): Promise<void>;
  /** Switch the radio on after a cut: the loader restarts from its record. */
  powerOn(): Promise<void>;
  status(): Promise<BridgeStatus>;
  /** Close the socket; the bridge exits. */
  dispose(): Promise<void>;
}

function frame(type: number, payload: Uint8Array = new Uint8Array(0)): Buffer {
  const out = Buffer.alloc(3 + payload.length);
  out.writeUInt8(type, 0);
  out.writeUInt16LE(payload.length, 1);
  out.set(payload, 3);
  return out;
}

function u32(n: number): Uint8Array {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

interface Waiter<V> {
  ok: (v: V) => void;
  fail: (e: Error) => void;
}

export async function connectBridgeSerialPort(hostPort: string): Promise<BridgeSerialPort> {
  const sep = hostPort.lastIndexOf(':');
  const host = hostPort.slice(0, sep);
  const portNo = Number(hostPort.slice(sep + 1));
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('The emulator bridge is local only: use 127.0.0.1:<port>.');
  }
  const socket: Socket = await new Promise((resolve, reject) => {
    const s = connect({ host, port: portNo }, () => resolve(s));
    s.once('error', reject);
  });
  socket.setNoDelay(true);

  const rxWaiters: Waiter<Uint8Array>[] = [];
  const statusWaiters: Waiter<BridgeStatus>[] = [];
  let failure: Error | null = null;
  const fail = (e: Error) => {
    failure ??= e;
    for (const w of [...rxWaiters.splice(0), ...statusWaiters.splice(0)]) w.fail(e);
  };

  let inbuf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    inbuf = Buffer.concat([inbuf, chunk]);
    while (inbuf.length >= 3) {
      const len = inbuf.readUInt16LE(1);
      if (inbuf.length < 3 + len) break;
      const type = inbuf.readUInt8(0);
      const payload = inbuf.subarray(3, 3 + len);
      inbuf = inbuf.subarray(3 + len);
      if (type === T.RXDATA) rxWaiters.shift()?.ok(new Uint8Array(payload));
      else if (type === T.STATUS_REPLY)
        statusWaiters.shift()?.ok(JSON.parse(payload.toString('utf8')) as BridgeStatus);
      else if (type === T.ERROR) fail(new Error(`bridge error: ${payload.toString('utf8')}`));
    }
  });
  socket.on('error', (e) => fail(e));
  socket.on('close', () => fail(new Error('bridge connection closed')));

  const send = (type: number, payload?: Uint8Array): Promise<void> =>
    new Promise((resolve, reject) => {
      if (failure) return reject(failure);
      socket.write(frame(type, payload), (err) => (err ? reject(err) : resolve()));
    });

  // Replies come back in request order, so the waiter is queued together with the request.
  const request = <V>(waiters: Waiter<V>[], type: number, payload?: Uint8Array): Promise<V> =>
    new Promise<V>((ok, failWith) => {
      if (failure) return failWith(failure);
      waiters.push({ ok, fail: failWith });
      socket.write(frame(type, payload), (err) => {
        if (err) fail(err);
      });
    });

  const calls: BridgeCall[] = [];
  let isOpen = false;
  let readable: ReadableStream<Uint8Array> | null = null;
  let writable: WritableStream<Uint8Array> | null = null;
  let writableClosed = false;

  const makeReadable = () =>
    new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          const data = await request(rxWaiters, T.RX, u32(BRIDGE_RX_SLICE_MS));
          if (data.length > 0) {
            try {
              controller.enqueue(data);
            } catch {
              /* cancelled by a reopen: what was in flight is lost, as on a real port */
            }
          }
        },
      },
      { highWaterMark: 1 },
    );

  const makeWritable = () => {
    writableClosed = false;
    return new WritableStream<Uint8Array>({
      async write(chunk) {
        // A message carries at most 65535 bytes.
        for (let i = 0; i < chunk.length; i += 0xffff) {
          await send(T.TX, chunk.subarray(i, i + 0xffff));
        }
      },
      close() {
        writableClosed = true;
      },
    });
  };

  const port: SerialPortLike = {
    get readable() {
      return readable;
    },
    get writable() {
      // Like a real port, a new stream appears after the previous one was closed while the port is open.
      if (isOpen && writableClosed) writable = makeWritable();
      return writable;
    },
    async open({ baudRate }) {
      calls.push({ type: 'open', baudRate, at: Date.now() });
      await send(T.BAUD, u32(baudRate));
      isOpen = true;
      readable = makeReadable();
      writable = makeWritable();
    },
    async close() {
      calls.push({ type: 'close', at: Date.now() });
      isOpen = false;
      readable = null;
      writable = null;
    },
    async setSignals(signals) {
      calls.push({ type: 'setSignals', signals, at: Date.now() });
    },
  };

  return {
    port,
    calls,
    cut: (n) => send(T.CUT, u32(n)),
    powerOn: () => send(T.POWER_ON),
    status: () => request(statusWaiters, T.STATUS),
    dispose: () =>
      new Promise<void>((resolve) => {
        if (socket.destroyed) return resolve();
        socket.once('close', () => resolve());
        socket.destroy();
      }),
  };
}
