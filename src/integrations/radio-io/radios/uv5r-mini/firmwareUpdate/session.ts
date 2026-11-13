/**
 * The host's half of the UV-5R Mini update protocol, with no I/O. The updater feeds it each good frame from the radio
 * and sends back what it returns, at the rate it names, then changes the link's rate when `switchTo` is set.
 *
 * Phases: `listen` (nothing sent yet; the updater waits before it pings) -> `ping` -> `app` (the stock app's update
 * stage, 9600) -> `loader` (38400) -> `done`. A radio whose loader restarted from its record after a cut talks first:
 * a cmd 1 heard in `listen` skips the app stage (`continued`).
 *
 * Every frame this returns is also checked by `checkUv5rMiniOutgoing` before it is written; the session itself never
 * writes. Port of `Session` in the firmware project's host tool.
 */
import {
  encodeUv5rMiniFrame,
  UV5RMINI_FW_APP_BAUD,
  UV5RMINI_FW_CMD,
  UV5RMINI_FW_LOADER_BAUD,
  UV5RMINI_FW_MAX_DATA,
  uv5rMiniReadU32,
  uv5rMiniU32,
} from './frames.ts';

export type Uv5rMiniPhase = 'listen' | 'ping' | 'app' | 'loader' | 'done';

/** What the session did with a frame, in order. Hex is the frame's data, for diagnosis. */
export type Uv5rMiniSessionEvent =
  | { kind: 'ping' }
  /** The app's empty cmd 1; answered with the rate it already runs at. */
  | { kind: 'pong'; rate: number }
  /** A cmd 1 in `listen`: the loader restarted from its record and talked first. */
  | { kind: 'loader-first'; rate: number }
  /** A cmd 1 in `app` after reads: the app reset into the loader. */
  | { kind: 'handover'; rate: number }
  /** A cmd 1 in `loader`: its hello again, at the new rate. */
  | { kind: 'loader-hello'; rate: number }
  | { kind: 'read'; off: number; len: number; inImage: boolean }
  | { kind: 'length'; len: number }
  | { kind: 'result'; code: number; phase: Uv5rMiniPhase }
  | { kind: 'bad-crc'; hex: string }
  | { kind: 'ignored'; cmd: number; phase: Uv5rMiniPhase; hex: string };

export interface Uv5rMiniReply {
  /** Whole frames to send, in order. Empty when the rule says no reply. */
  frames: Uint8Array[];
  /** The rate they go out at (the rate before a switch). */
  rate: number;
  /** Set when the link must change to this rate after the frames have left. */
  switchTo?: number;
  /** Set when the radio asked for bytes the image does not have, or more than one frame may carry. The reply holds
   *  what exists (as the original tool does); the outgoing guard refuses it. */
  flagged?: string;
  /** With `flagged`: the loader read past the image before any cmd 4, so it planned no area (already installed). */
  alreadyInstalled?: true;
}

const NO_REPLY = (rate: number): Uv5rMiniReply => ({ frames: [], rate });

const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export class Uv5rMiniSession {
  readonly image: Uint8Array;
  readonly events: Uv5rMiniSessionEvent[] = [];
  /** The rate the host listens at now. Starts at the app rate; changes when a reply carries `switchTo`. */
  rate = UV5RMINI_FW_APP_BAUD;
  phase: Uv5rMiniPhase = 'listen';
  /** True when the loader talked first (a restart from its record): there was no app stage in this session. */
  continued = false;
  /** The loader's area length from cmd 4, once it has announced the erase. */
  areaLength: number | undefined;
  /** The first cmd 3 code, and the phase it arrived in. */
  result: number | undefined;
  resultPhase: Uv5rMiniPhase | undefined;
  /** Data requests answered. */
  reads = 0;

  private readonly lastData = new Map<number, Uint8Array>();

  constructor(image: Uint8Array) {
    this.image = image;
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  /** The data of the radio's most recent good frame of this command (the outgoing guard's ground truth). */
  lastRadioData(cmd: number): Uint8Array | undefined {
    return this.lastData.get(cmd);
  }

  /** The ping: cmd 6, empty. Moves `listen` to `ping`; harmless again later. */
  ping(): Uv5rMiniReply {
    if (this.phase === 'listen') this.phase = 'ping';
    this.events.push({ kind: 'ping' });
    return { frames: [encodeUv5rMiniFrame(UV5RMINI_FW_CMD.PING)], rate: this.rate };
  }

  /** A frame the parser rejected: logged, never used. */
  noteBadCrc(hex: string): void {
    this.events.push({ kind: 'bad-crc', hex });
  }

  /** One good frame from the radio. Returns what to send back. */
  onFrame(cmd: number, data: Uint8Array): Uv5rMiniReply {
    const rate = this.rate;
    this.lastData.set(cmd, data.slice());
    switch (cmd) {
      case UV5RMINI_FW_CMD.BAUD:
        return this.onBaud(data, rate);
      case UV5RMINI_FW_CMD.DATA:
        return this.onData(data, rate);
      case UV5RMINI_FW_CMD.LENGTH:
        if (this.phase === 'loader' && data.length >= 4) {
          this.areaLength = uv5rMiniReadU32(data);
          this.events.push({ kind: 'length', len: this.areaLength });
          return { frames: [encodeUv5rMiniFrame(cmd, data)], rate };
        }
        return this.ignore(cmd, data, rate);
      case UV5RMINI_FW_CMD.RESULT:
        return this.onResult(data, rate);
      default:
        return this.ignore(cmd, data, rate);
    }
  }

  private ignore(cmd: number, data: Uint8Array, rate: number): Uv5rMiniReply {
    this.events.push({ kind: 'ignored', cmd, phase: this.phase, hex: hexOf(data) });
    return NO_REPLY(rate);
  }

  private onBaud(data: Uint8Array, rate: number): Uv5rMiniReply {
    const loaderRate = (): Uv5rMiniReply => {
      this.rate = UV5RMINI_FW_LOADER_BAUD;
      return {
        frames: [encodeUv5rMiniFrame(UV5RMINI_FW_CMD.BAUD, uv5rMiniU32(UV5RMINI_FW_LOADER_BAUD))],
        rate,
        switchTo: UV5RMINI_FW_LOADER_BAUD,
      };
    };
    switch (this.phase) {
      case 'listen':
        // The loader restarted from its record after a cut and talks first, at the app rate.
        this.continued = true;
        this.phase = 'loader';
        this.events.push({ kind: 'loader-first', rate });
        return loaderRate();
      case 'ping':
        if (data.length === 0) {
          // The app's pong. Ask for the rate it already runs at, so the update starts with no echo.
          this.phase = 'app';
          this.events.push({ kind: 'pong', rate });
          return {
            frames: [encodeUv5rMiniFrame(UV5RMINI_FW_CMD.BAUD, uv5rMiniU32(UV5RMINI_FW_APP_BAUD))],
            rate,
          };
        }
        return this.ignore(UV5RMINI_FW_CMD.BAUD, data, rate);
      case 'app':
        if (this.reads > 0) {
          // The app has reset into the loader, which says hello at the old rate.
          this.phase = 'loader';
          this.events.push({ kind: 'handover', rate });
          return loaderRate();
        }
        return this.ignore(UV5RMINI_FW_CMD.BAUD, data, rate);
      case 'loader':
        // The loader repeats its hello at the new rate until it is answered.
        this.events.push({ kind: 'loader-hello', rate });
        return {
          frames: [encodeUv5rMiniFrame(UV5RMINI_FW_CMD.BAUD, uv5rMiniU32(UV5RMINI_FW_LOADER_BAUD))],
          rate,
        };
      default:
        return this.ignore(UV5RMINI_FW_CMD.BAUD, data, rate);
    }
  }

  private onData(data: Uint8Array, rate: number): Uv5rMiniReply {
    if (this.phase === 'listen' || this.phase === 'done' || data.length < 8) {
      return this.ignore(UV5RMINI_FW_CMD.DATA, data, rate);
    }
    const off = uv5rMiniReadU32(data, 0);
    const len = uv5rMiniReadU32(data, 4);
    const inImage = off + len <= this.image.length;
    this.events.push({ kind: 'read', off, len, inImage });
    this.reads += 1;
    const body = new Uint8Array(8 + Math.max(0, Math.min(len, this.image.length - off, 0xfff0)));
    body.set(data.subarray(0, 8), 0);
    if (off < this.image.length) body.set(this.image.subarray(off, off + body.length - 8), 8);
    const reply: Uv5rMiniReply = {
      frames: [encodeUv5rMiniFrame(UV5RMINI_FW_CMD.DATA, body)],
      rate,
    };
    if (!inImage) {
      reply.flagged = `read ${off.toString(16)}+${len.toString(16)} is outside the image`;
      // A loader that finds the installed app equal to the image plans no area, sends no cmd 4, and walks on past the
      // end of the file: nothing has been or will be written. The pinned L1/L2 loaders always plan the whole area, so
      // with them this is unreachable; it is kept as a defensive classification (and for the list-carrying loaders,
      // whose same-build image the interlocks refuse before anything is sent).
      if (this.phase === 'loader' && this.areaLength === undefined) reply.alreadyInstalled = true;
    } else if (len > UV5RMINI_FW_MAX_DATA)
      reply.flagged = `read of ${len.toString(16)} bytes is over the frame limit`;
    return reply;
  }

  private onResult(data: Uint8Array, rate: number): Uv5rMiniReply {
    if (data.length === 0) return this.ignore(UV5RMINI_FW_CMD.RESULT, data, rate);
    const phase = this.phase;
    if (this.result === undefined) {
      this.result = data[0]!;
      this.resultPhase = phase;
      this.events.push({ kind: 'result', code: data[0]!, phase });
    }
    this.phase = 'done';
    // The loader wants its result echoed (also if it repeats it); the app does not.
    return this.resultPhase === 'loader'
      ? { frames: [encodeUv5rMiniFrame(UV5RMINI_FW_CMD.RESULT, data)], rate }
      : NO_REPLY(rate);
  }
}

export function createUv5rMiniSession(image: Uint8Array): Uv5rMiniSession {
  return new Uv5rMiniSession(image);
}
