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
 * Emulated time passes only while the host reads, and the readable keeps it in step with real time: each read request
 * asks for the real milliseconds since the last one (at least `BRIDGE_RX_MIN_STEP_MS` apart, at most `BRIDGE_RX_MAX_MS`),
 * so the host's real-time timeouts and the loader's emulated hello window mean the same thing. A `reopen` is a `close()`
 * plus an `open()` on the same connection; the radio keeps running while the port is closed (open catches the emulated
 * clock up and drops what the radio said meanwhile), as a real radio does.
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

/** Fewest real milliseconds between read requests, and most emulated milliseconds one request asks for. */
export const BRIDGE_RX_MIN_STEP_MS = 10;
export const BRIDGE_RX_MAX_MS = 50;

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
  | { type: 'write'; bytes: number; at: number }
  | {
      type: 'setSignals';
      signals: { dataTerminalReady?: boolean; requestToSend?: boolean };
      at: number;
    };

export interface BridgeSerialPort {
  readonly port: SerialPortLike;
  /** Every port call in order, with `Date.now()`. */
  readonly calls: BridgeCall[];
  /** One line per chunk written or read (rate, length, first bytes), for a failure report. */
  readonly trace: string[];
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
  const trace: string[] = [];
  let rate = 0;
  let lastRxAt = 0;
  const note = (dir: string, b: Uint8Array) =>
    trace.push(`${dir} @${rate} ${b.length}B ${Buffer.from(b.subarray(0, 12)).toString('hex')}`);
  let isOpen = false;
  let readable: ReadableStream<Uint8Array> | null = null;
  let writable: WritableStream<Uint8Array> | null = null;
  let writableClosed = false;

  const makeReadable = () => {
    let cancelled = false;
    return new ReadableStream<Uint8Array>(
      {
        // One pull runs the radio until it says something: an empty answer does not re-trigger a pull by itself.
        async pull(controller) {
          while (!cancelled) {
            const idle = BRIDGE_RX_MIN_STEP_MS - (Date.now() - lastRxAt);
            if (idle > 0) await new Promise((resolve) => setTimeout(resolve, idle));
            if (cancelled) return;
            const ms = Math.min(Math.max(Date.now() - lastRxAt, 1), BRIDGE_RX_MAX_MS);
            lastRxAt = Date.now();
            const data = await request(rxWaiters, T.RX, u32(ms));
            if (cancelled) return; // what was in flight at a reopen is lost, as on a real port
            if (data.length > 0) {
              note('rx', data);
              controller.enqueue(data);
              return;
            }
          }
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 1 },
    );
  };

  const makeWritable = () => {
    writableClosed = false;
    return new WritableStream<Uint8Array>({
      async write(chunk) {
        note('tx', chunk);
        calls.push({ type: 'write', bytes: chunk.length, at: Date.now() });
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
      rate = baudRate;
      if (lastRxAt > 0) {
        // The radio ran while the port was closed; what it said then reached nobody.
        const closedMs = Math.min(Date.now() - lastRxAt, 2000);
        lastRxAt = Date.now();
        await request(rxWaiters, T.RX, u32(closedMs));
      }
      // Stamped once the port is usable again: close to open is the reopen's whole cost.
      calls.push({ type: 'open', baudRate, at: Date.now() });
      await send(T.BAUD, u32(baudRate));
      lastRxAt = Date.now();
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
    trace,
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
