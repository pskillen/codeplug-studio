/**
 * Guarded raw-pipe runner for the RT95 safety backup (used by the firmware wizard, which has no
 * connected protocol). It opens its own session, reads, and sends END on every path. The only frames
 * it can send are PROGRAM, `02`, a 16-byte read and END: a write cannot leave this module.
 */
import { createGuardedSend } from '../../../firmware/guardedSend.ts';
import {
  enterProgramQxMode,
  exitProgramQxMode,
  makeProgramQxReadFrame,
  parseProgramQxReadReply,
  probeProgramQxIdent,
  PROGRAM_QX_BLOCK_SIZE,
  PROGRAM_QX_READ_REPLY_LEN,
  sendProgramQxCommand,
} from '../../../kit/codecs/programQx.ts';
import {
  RadioAbortedError,
  RadioInterlockError,
  RadioNoResponseError,
  RadioTimeoutError,
} from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe, ProgressFn } from '../../../types.ts';
import { RT95_IO_TIMEOUT_MS } from '../constants.ts';
import { parseRt95IdentResponse, type Rt95IdentResult } from '../ident.ts';
import {
  buildRt95SafetyManifest,
  packRt95SafetyZip,
  rt95SafetyBackupRadioKey,
  rt95SafetyBaseName,
  type Rt95SafetyManifest,
} from './files.ts';
import { readRt95SafetyRegion, type Rt95SafetyRegion } from './reader.ts';

export const RT95_SAFETY_ENTER_ATTEMPTS = 5;
export const RT95_SAFETY_ENTER_RETRY_MS = 1000;

const PROGRAM = new TextEncoder().encode('PROGRAM');
const END = new TextEncoder().encode('END');

function same(frame: Uint8Array, want: Uint8Array): boolean {
  return frame.length === want.length && want.every((b, i) => frame[i] === b);
}

/** Allows exactly `PROGRAM`, `02`, a 4-byte read `52 hi lo 10`, and `END`. Everything else is refused. */
export function checkRt95SafetyBackupOutgoing(frame: Uint8Array): void {
  if (
    same(frame, PROGRAM) ||
    same(frame, END) ||
    (frame.length === 1 && frame[0] === 0x02) ||
    (frame.length === 4 && frame[0] === 0x52 && frame[3] === PROGRAM_QX_BLOCK_SIZE)
  ) {
    return;
  }
  const head = Array.from(frame.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ');
  throw new RadioInterlockError(
    `Refused to send ${head || 'an empty frame'}${frame.length > 8 ? '…' : ''}: the safety backup only reads the radio.`,
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RadioAbortedError());
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new RadioAbortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function rt95SafetyToolName(): string {
  const env = typeof __BUILD_ENV__ === 'string' ? __BUILD_ENV__ : 'dev';
  const version = typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'local';
  return `codeplug-studio ${env} ${version}`;
}

export interface RunRt95SafetyBackupOptions {
  region: Rt95SafetyRegion;
  /** The serial the operator typed from the radio's label (required). */
  serial: string;
  signal?: AbortSignal;
  onProgress?: ProgressFn;
  /** Gap between PROGRAM attempts (tests shrink it). */
  retryDelayMs?: number;
  now?: () => Date;
}

export interface Rt95SafetyBackupResult {
  ident: Rt95IdentResult;
  radioKey: string;
  region: Rt95SafetyRegion;
  bytes: Uint8Array;
  manifest: Rt95SafetyManifest;
  zipBytes: Uint8Array;
  /** The `.zip` file name. */
  fileName: string;
}

/** Pack a finished read into the zip and manifest. Shared by the runner and the Backup page service. */
export async function packRt95SafetyResult(input: {
  region: Rt95SafetyRegion;
  serial: string;
  ident: Rt95IdentResult;
  bytes: Uint8Array;
  rereads: readonly number[];
  now?: Date;
}): Promise<Rt95SafetyBackupResult> {
  const now = input.now ?? new Date();
  const manifest = await buildRt95SafetyManifest({
    region: input.region,
    bytes: input.bytes,
    ident: input.ident,
    rereads: input.rereads,
    serial: input.serial,
    now,
    tool: rt95SafetyToolName(),
  });
  const baseName = rt95SafetyBaseName(input.region, manifest.serial, now);
  return {
    ident: input.ident,
    radioKey: rt95SafetyBackupRadioKey(manifest.serial),
    region: input.region,
    bytes: input.bytes,
    manifest,
    zipBytes: packRt95SafetyZip(manifest, input.bytes, baseName),
    fileName: `${baseName}.zip`,
  };
}

export async function runRt95SafetyBackup(
  pipe: BytePipe,
  opts: RunRt95SafetyBackupOptions,
): Promise<Rt95SafetyBackupResult> {
  const out = await runCore(pipe, opts);
  if (out.kind !== 'taken') throw new RadioInterlockError('Unexpected safety backup state.');
  return out.result;
}

export type Rt95SafetyBackupOnceOutcome =
  | { kind: 'already-saved'; ident: Rt95IdentResult; radioKey: string }
  | { kind: 'taken'; result: Rt95SafetyBackupResult };

/**
 * As {@link runRt95SafetyBackup}, but stops right after the ident when `isSaved(radioKey)` is true: nothing is read
 * from the calibration region. `radioKey` is the normalised typed serial (decision 33), never the ident.
 */
export function runRt95SafetyBackupUnlessSaved(
  pipe: BytePipe,
  opts: RunRt95SafetyBackupOptions & { isSaved: (radioKey: string) => boolean },
): Promise<Rt95SafetyBackupOnceOutcome> {
  return runCore(pipe, opts, opts.isSaved);
}

async function runCore(
  pipe: BytePipe,
  opts: RunRt95SafetyBackupOptions,
  isSaved?: (radioKey: string) => boolean,
): Promise<Rt95SafetyBackupOnceOutcome> {
  const guarded = createGuardedSend(pipe, checkRt95SafetyBackupOutgoing);
  const wrapped: BytePipe = {
    write: guarded,
    readExact: (n, t) => pipe.readExact(n, t),
    flush: pipe.flush ? () => pipe.flush!() : undefined,
    close: () => pipe.close(),
  };
  const retryDelayMs = opts.retryDelayMs ?? RT95_SAFETY_ENTER_RETRY_MS;

  let entered = false;
  try {
    for (let attempt = 0; attempt < RT95_SAFETY_ENTER_ATTEMPTS && !entered; attempt++) {
      throwIfAborted(opts.signal);
      try {
        await enterProgramQxMode(wrapped, RT95_IO_TIMEOUT_MS);
        entered = true;
      } catch (err) {
        if (!(err instanceof RadioTimeoutError)) throw err;
        await wrapped.flush?.();
        if (attempt < RT95_SAFETY_ENTER_ATTEMPTS - 1) await sleep(retryDelayMs, opts.signal);
      }
    }
    if (!entered) {
      throw new RadioNoResponseError(
        `The radio did not answer after ${RT95_SAFETY_ENTER_ATTEMPTS} tries. Is it switched on normally, with the cable connected? If you just read the radio with Studio, wait a few seconds and try again.`,
      );
    }
    const ident = parseRt95IdentResponse(await probeProgramQxIdent(wrapped, RT95_IO_TIMEOUT_MS));
    const key = rt95SafetyBackupRadioKey(opts.serial);
    if (isSaved?.(key)) return { kind: 'already-saved', ident, radioKey: key };
    const { bytes, rereads } = await readRt95SafetyRegion(
      async (addr) =>
        parseProgramQxReadReply(
          await sendProgramQxCommand(
            wrapped,
            makeProgramQxReadFrame(addr, PROGRAM_QX_BLOCK_SIZE),
            PROGRAM_QX_READ_REPLY_LEN,
            RT95_IO_TIMEOUT_MS,
          ),
          PROGRAM_QX_BLOCK_SIZE,
        ),
      { region: opts.region, signal: opts.signal, onProgress: opts.onProgress },
    );
    const result = await packRt95SafetyResult({
      region: opts.region,
      serial: opts.serial,
      ident,
      bytes,
      rereads,
      now: opts.now?.(),
    });
    return { kind: 'taken', result };
  } finally {
    // END leaves clone mode and puts the main board back, on every path.
    if (entered) {
      try {
        await exitProgramQxMode(wrapped);
      } catch {
        /* the port may be gone */
      }
    }
  }
}
