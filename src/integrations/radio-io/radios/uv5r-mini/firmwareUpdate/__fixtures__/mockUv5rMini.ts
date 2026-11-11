/**
 * Test-only UV-5R Mini that plays the radio's side of the firmware update, as a `SerialPortLike` on `fakeSerialPort`.
 * A model of the frame rules and the timing, not of the real firmware. The image is synthetic.
 *
 * It knows the rate the host opened the port at (each `open({ baudRate })`) and its own rate. Bytes at a mismatched
 * rate turn into deterministic garbage both ways: the host reads garbage when the radio sends at a rate it is not
 * listening at, and the radio hears garbage when the host sends at a rate it is not running at.
 *
 * The script (offsets scaled to the synthetic image; see `makeSyntheticUv5rMiniImage`):
 *
 * - the app (9600): answers the ping with an empty cmd 1; on the host's `{9600}` it reads the header, the same
 *   block three times, the directory block, a short read, then the loader part in 0x200 reads (the last short); then
 *   it resets into the loader (`handoverDelayMs`) and keeps its record.
 * - the loader: empty cmd 1 at 9600; on the host's `{38400}` it changes its own rate, waits `firstRepeatDelayMs`, then
 *   repeats an empty cmd 1 at 38400 every `repeatIntervalMs` until it is answered or `giveUpMs` have passed since
 *   the first one; giving up it resets (record kept) and, `restartDelayMs` later, talks first again at 9600. Answered,
 *   it makes its reads, cmd 4 `{area length}`, two small reads, the area top-down in 0x200 reads ending at the
 *   directory block, then cmd 3 `{0}`; the host echoes cmd 4 and cmd 3.
 *
 * Timers are the global `setTimeout`, so tests use fake timers and call {@link MockUv5rMini.dispose} when done.
 */
import {
  encodeUv5rMiniFrame,
  Uv5rMiniFrameParser,
  UV5RMINI_FW_APP_BAUD,
  UV5RMINI_FW_CMD,
  UV5RMINI_FW_LOADER_BAUD,
  uv5rMiniU32,
} from '../frames.ts';
import {
  createFakeSerialPort,
  type FakeSerialController,
} from '../../../../transport/fakeSerialPort.ts';
import type { SerialPortLike } from '../../../../transport/webSerialPipe.ts';

const { BAUD, DATA, RESULT, LENGTH, PING } = UV5RMINI_FW_CMD;

/** Where the synthetic image's directory block sits (the last area read ends there). */
export const MOCK_DIR_OFFSET = 0x3200;
/** Where the loader part the app reads sits in the synthetic image, and its length (0x200 reads, the last short). */
export const MOCK_LOADER_PART_OFFSET = 0x1000;
export const MOCK_LOADER_PART_LENGTH = 0x2a0;

/** A deterministic synthetic image: `0x3200 + areaBlocks * 0x200` bytes of xorshift output. */
export function makeSyntheticUv5rMiniImage(areaBlocks = 8): Uint8Array {
  const out = new Uint8Array(MOCK_DIR_OFFSET + areaBlocks * 0x200);
  let x = 0x2545f491;
  for (let i = 0; i < out.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = (x >>> 0) & 0xff;
  }
  return out;
}

export interface Uv5rMiniMockOptions {
  /** The image the radio "reads". Default: `makeSyntheticUv5rMiniImage(areaBlocks)`. */
  readonly image?: Uint8Array;
  /** The area is `areaBlocks * 0x200` bytes from the directory block up. Default 8. */
  readonly areaBlocks?: number;
  /** Goes silent (power lost) after this many area reads have been answered. Power it back with `powerOn()`. */
  readonly cutAfterAreaReads?: number;
  /** Starts off; `powerOn()` then starts the loader at 9600, talking first, from its record. */
  readonly restartFromRecord?: boolean;
  /** The loader sends cmd 3 with this code instead of cmd 4 (a refusal before erasing). */
  readonly loaderRefuses?: number;
  /** The app sends cmd 3 with this code after its first read instead of going on (nothing written). */
  readonly appResult?: number;
  /** The app never answers the ping. */
  readonly ignorePing?: boolean;
  /**
   * The radio hears a host frame only once its last byte has crossed the wire (`bytes x 10 / host rate`), so a long reply
   * at 9600 takes its real time and the next request comes after it. Off by default (frames are heard at once); the
   * updater's tests turn it on, because a pipe's reopen must wait for what is still queued.
   */
  readonly modelWire?: boolean;
  readonly timing?: {
    /** App finished reading to its cmd 1 in the loader. Default 100. */
    readonly handoverDelayMs?: number;
    /** From the host's `{38400}` to the loader's first cmd 1 at 38400. Default 330. */
    readonly firstRepeatDelayMs?: number;
    /** Between the loader's cmd 1 repeats at 38400. Default 100. */
    readonly repeatIntervalMs?: number;
    /** After its first cmd 1 at 38400, the loader gives up this long later. Default 700. */
    readonly giveUpMs?: number;
    /** From giving up to talking first at 9600 again. Default 500. */
    readonly restartDelayMs?: number;
  };
}

export type Uv5rMiniMockState =
  | 'off'
  | 'app-idle'
  | 'app-reading'
  | 'loader-wait-baud'
  | 'loader-new-rate'
  | 'loader-reading'
  | 'restarting'
  | 'cut'
  | 'finished';

export interface MockFrame {
  cmd: number;
  data: Uint8Array;
  /** The rate the sender was running at. */
  rate: number;
}

export interface MockUv5rMini {
  /** The port the host opens. Each `open()` is a fresh link at that rate; `close()` ends the current one. */
  readonly port: SerialPortLike;
  readonly image: Uint8Array;
  /** The area length the loader announces in cmd 4. */
  readonly areaLength: number;
  readonly state: Uv5rMiniMockState;
  readonly radioRate: number;
  /** The rate of the host's current (or last) `open()`; 0 before the first. */
  readonly hostRate: number;
  /** Every frame the host wrote, in order, with whether the radio could hear it (rates matched). */
  readonly hostFrames: ReadonlyArray<MockFrame & { heard: boolean }>;
  /** Every frame the radio sent, in order, with whether the host was open at that rate to hear it. */
  readonly radioFrames: ReadonlyArray<MockFrame & { heard: boolean }>;
  /** Replies the host sent that were not the expected one (wrong bytes), and so did not advance the radio. */
  readonly badReplies: number;
  /** Area reads answered so far. */
  readonly areaReads: number;
  /** Times the loader gave up waiting at the new rate and reset. */
  readonly loaderResets: number;
  /** The radio started the loader from its record, at some point. */
  readonly recordKept: boolean;
  /** Power-on after `restartFromRecord` or a cut. */
  powerOn(): void;
  /** Clear every pending timer. */
  dispose(): void;
}

interface Step {
  kind: 'app-read' | 'loader-read' | 'area-read' | 'length' | 'result';
  cmd: number;
  /** What the radio sends. */
  data: Uint8Array;
  /** What the host must answer with (cmd, data). */
  expect: Uint8Array;
}

const equal = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
const cat = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => Array.from(p)));

/** What a host without the right rate hears: the same length, every byte changed, the same way each time. */
export function garbleUv5rMiniBytes(bytes: Uint8Array): Uint8Array {
  return bytes.map((b, i) => (b ^ 0x5a ^ ((i * 37 + 11) & 0xff)) & 0xff);
}

export function createMockUv5rMini(options: Uv5rMiniMockOptions = {}): MockUv5rMini {
  const areaBlocks = options.areaBlocks ?? 8;
  const image = options.image ?? makeSyntheticUv5rMiniImage(areaBlocks);
  const areaLength = areaBlocks * 0x200;
  const timing = {
    handoverDelayMs: options.timing?.handoverDelayMs ?? 100,
    firstRepeatDelayMs: options.timing?.firstRepeatDelayMs ?? 330,
    repeatIntervalMs: options.timing?.repeatIntervalMs ?? 100,
    giveUpMs: options.timing?.giveUpMs ?? 700,
    restartDelayMs: options.timing?.restartDelayMs ?? 500,
  };

  const hostFrames: Array<MockFrame & { heard: boolean }> = [];
  const radioFrames: Array<MockFrame & { heard: boolean }> = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const radioParser = new Uv5rMiniFrameParser();
  const hostParser = new Uv5rMiniFrameParser();

  let state: Uv5rMiniMockState = options.restartFromRecord ? 'off' : 'app-idle';
  let radioRate = UV5RMINI_FW_APP_BAUD;
  let hostRate = 0;
  let isOpen = false;
  let steps: Step[] = [];
  let awaiting: Step | undefined;
  let badReplies = 0;
  let areaReads = 0;
  let loaderResets = 0;
  let recordKept = false;
  let appReads = 0;
  let cutDone = false;
  /** When the host's bytes so far have all crossed the wire, at the host's rate. */
  let wireFreeAt = 0;
  let current: FakeSerialController;

  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const emit = (cmd: number, data: Uint8Array) => {
    const heard = isOpen && hostRate === radioRate;
    radioFrames.push({ cmd, data: data.slice(), rate: radioRate, heard });
    if (!isOpen) return;
    const frame = encodeUv5rMiniFrame(cmd, data);
    current.pushRead(heard ? frame : garbleUv5rMiniBytes(frame));
  };

  const readStep = (kind: Step['kind'], off: number, len: number): Step => {
    const req = cat(uv5rMiniU32(off), uv5rMiniU32(len));
    return { kind, cmd: DATA, data: req, expect: cat(req, image.subarray(off, off + len)) };
  };
  const echoStep = (kind: 'length' | 'result', cmd: number, data: Uint8Array): Step => ({
    kind,
    cmd,
    data,
    expect: data,
  });

  const appSteps = (): Step[] => {
    const s: Step[] = [
      readStep('app-read', 0, 0x200),
      readStep('app-read', 0x200, 0x200),
      readStep('app-read', 0x200, 0x200),
      readStep('app-read', 0x200, 0x200),
      readStep('app-read', MOCK_DIR_OFFSET, 0x200),
      readStep('app-read', 0x200, 0x20),
    ];
    for (let o = 0; o < MOCK_LOADER_PART_LENGTH; o += 0x200) {
      s.push(
        readStep(
          'app-read',
          MOCK_LOADER_PART_OFFSET + o,
          Math.min(0x200, MOCK_LOADER_PART_LENGTH - o),
        ),
      );
    }
    return s;
  };

  const loaderSteps = (): Step[] => {
    const s: Step[] = [
      readStep('loader-read', 0, 0x200),
      readStep('loader-read', 0x200, 0x200),
      readStep('loader-read', 0x200, 0x200),
      readStep('loader-read', 0x200, 0x20),
      readStep('loader-read', 0x200, 0x200),
      readStep('loader-read', MOCK_DIR_OFFSET, 0x200),
      readStep('loader-read', MOCK_DIR_OFFSET, 0x20),
    ];
    if (options.loaderRefuses !== undefined) {
      s.push(echoStep('result', RESULT, Uint8Array.from([options.loaderRefuses])));
      return s;
    }
    s.push(echoStep('length', LENGTH, uv5rMiniU32(areaLength)));
    s.push(readStep('loader-read', 4, 0x10), readStep('loader-read', 4, 0x10));
    for (let b = areaBlocks - 1; b >= 0; b--)
      s.push(readStep('area-read', MOCK_DIR_OFFSET + b * 0x200, 0x200));
    s.push(echoStep('result', RESULT, Uint8Array.from([0])));
    return s;
  };

  const sendNext = () => {
    awaiting = steps.shift();
    if (awaiting) emit(awaiting.cmd, awaiting.data);
  };

  const startLoader = () => {
    recordKept = true;
    radioRate = UV5RMINI_FW_APP_BAUD;
    state = 'loader-wait-baud';
    emit(BAUD, new Uint8Array(0));
  };

  const giveUp = () => {
    loaderResets += 1;
    radioRate = UV5RMINI_FW_APP_BAUD;
    state = 'restarting';
    later(timing.restartDelayMs, startLoader);
  };

  const repeatHello = (elapsed: number) => {
    if (state !== 'loader-new-rate') return;
    if (elapsed >= timing.giveUpMs) {
      giveUp();
      return;
    }
    emit(BAUD, new Uint8Array(0));
    later(timing.repeatIntervalMs, () => repeatHello(elapsed + timing.repeatIntervalMs));
  };

  const accepted = (step: Step) => {
    if (step.kind === 'area-read') {
      areaReads += 1;
      if (
        !cutDone &&
        options.cutAfterAreaReads !== undefined &&
        areaReads >= options.cutAfterAreaReads
      ) {
        cutDone = true;
        state = 'cut';
        awaiting = undefined;
        steps = [];
        return;
      }
    }
    if (step.kind === 'app-read') {
      appReads += 1;
      if (appReads === 1 && options.appResult !== undefined) {
        // The app refuses: its result goes out, and is not echoed.
        emit(RESULT, Uint8Array.from([options.appResult]));
        state = 'finished';
        awaiting = undefined;
        steps = [];
        return;
      }
    }
    if (step.kind === 'result') {
      state = 'finished';
      awaiting = undefined;
      return;
    }
    if (steps.length === 0 && state === 'app-reading') {
      awaiting = undefined;
      later(timing.handoverDelayMs, startLoader);
      return;
    }
    sendNext();
  };

  const onHostFrame = (cmd: number, data: Uint8Array) => {
    if (state === 'app-reading' || state === 'loader-reading') {
      if (awaiting && cmd === awaiting.cmd) {
        if (equal(data, awaiting.expect)) accepted(awaiting);
        else badReplies += 1;
      }
      return;
    }
    if (state === 'app-idle') {
      if (cmd === PING && !options.ignorePing) emit(BAUD, new Uint8Array(0));
      else if (cmd === BAUD && equal(data, uv5rMiniU32(UV5RMINI_FW_APP_BAUD))) {
        state = 'app-reading';
        steps = appSteps();
        sendNext();
      }
      return;
    }
    if (state === 'loader-wait-baud') {
      if (cmd === BAUD && equal(data, uv5rMiniU32(UV5RMINI_FW_LOADER_BAUD))) {
        radioRate = UV5RMINI_FW_LOADER_BAUD;
        state = 'loader-new-rate';
        later(timing.firstRepeatDelayMs, () => repeatHello(0));
      }
      return;
    }
    if (state === 'loader-new-rate') {
      if (cmd === BAUD && equal(data, uv5rMiniU32(UV5RMINI_FW_LOADER_BAUD))) {
        state = 'loader-reading';
        steps = loaderSteps();
        sendNext();
      }
    }
  };

  const onWrite = (chunk: Uint8Array) => {
    const heard = isOpen && hostRate === radioRate;
    for (const e of hostParser.feed(chunk)) {
      if (e.kind === 'frame')
        hostFrames.push({ cmd: e.cmd, data: e.data.slice(), rate: hostRate, heard });
    }
    // What the radio's own parser sees: the bytes as they arrive at its rate, once they have crossed the wire. A frame
    // is not heard until its last byte has been sent, so a long reply at a slow rate takes its real time and the radio
    // asks for the next slice only after that.
    const bytes = heard ? chunk : garbleUv5rMiniBytes(chunk);
    const deliver = () => {
      for (const e of radioParser.feed(bytes)) {
        if (e.kind === 'frame') onHostFrame(e.cmd, e.data);
      }
    };
    if (!options.modelWire) {
      deliver();
      return;
    }
    const now = Date.now();
    wireFreeAt = Math.max(wireFreeAt, now) + (chunk.length * 10 * 1000) / Math.max(hostRate, 1);
    later(Math.ceil(wireFreeAt - now), deliver);
  };

  const makeLink = (initiallyOpen: boolean) => createFakeSerialPort({ initiallyOpen, onWrite });
  current = makeLink(false);

  const port: SerialPortLike = {
    get readable() {
      return current.port.readable;
    },
    get writable() {
      return current.port.writable;
    },
    async open(opts) {
      current = makeLink(true);
      hostRate = opts.baudRate;
      isOpen = true;
    },
    async close() {
      isOpen = false;
      await current.port.close();
    },
  };

  return {
    port,
    image,
    areaLength,
    get state() {
      return state;
    },
    get radioRate() {
      return radioRate;
    },
    get hostRate() {
      return hostRate;
    },
    hostFrames,
    radioFrames,
    get badReplies() {
      return badReplies;
    },
    get areaReads() {
      return areaReads;
    },
    get loaderResets() {
      return loaderResets;
    },
    get recordKept() {
      return recordKept;
    },
    powerOn() {
      if (state !== 'off' && state !== 'cut') return;
      if (options.restartFromRecord || recordKept) startLoader();
      else state = 'app-idle';
    },
    dispose() {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    },
  };
}
