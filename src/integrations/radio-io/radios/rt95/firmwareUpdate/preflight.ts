/**
 * RT95 front panel pre-flight hard gate. The update-mode bootloader has no ident and no model check, and the P1 and
 * P3 power-on modes answer the same handshake, so Studio checks the radio in NORMAL mode first (a read-only
 * `PROGRAM`, `02`, `END` exchange at the codeplug baud rate) and asks the operator two questions it cannot answer
 * itself. See docs/reference/radios/retevis/rt95/firmware.md.
 */
import { createGuardedSend } from '../../../firmware/guardedSend.ts';
import type { FirmwarePreflightProbe, FirmwareRadioPreflight } from '../../../firmware/types.ts';
import {
  enterProgramQxMode,
  exitProgramQxMode,
  probeProgramQxIdent,
} from '../../../kit/codecs/programQx.ts';
import {
  RadioAbortedError,
  RadioInterlockError,
  RadioNoResponseError,
  RadioTimeoutError,
  RadioWrongIdentError,
} from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe } from '../../../types.ts';
import { parseRt95IdentResponse } from '../ident.ts';
import {
  RT95_ALLOWED_MODEL,
  RT95_ALLOWED_VERSION,
  RT95_BAUD_RATE,
  RT95_IO_TIMEOUT_MS,
} from '../constants.ts';
import {
  RT95_HEAD_FW_CLONE_END,
  RT95_HEAD_FW_IDENT_REQ,
  RT95_HEAD_FW_LINK,
  RT95_HEAD_FW_PROGRAM,
} from './constants.ts';

/** F43: after `END` the radio ignores `PROGRAM` for about 3 to 5 s, so the first attempts may go unanswered. */
export const RT95_PREFLIGHT_ATTEMPTS = 5;
export const RT95_PREFLIGHT_RETRY_DELAY_MS = 1000;

function same(frame: Uint8Array, want: Uint8Array): boolean {
  return frame.length === want.length && want.every((b, i) => frame[i] === b);
}

/** Allows exactly `PROGRAM`, the ident request `02` and `END`. Everything else is refused. */
export function checkRt95PreflightOutgoing(frame: Uint8Array): void {
  if (
    same(frame, RT95_HEAD_FW_PROGRAM) ||
    same(frame, RT95_HEAD_FW_CLONE_END) ||
    (frame.length === 1 && frame[0] === RT95_HEAD_FW_IDENT_REQ)
  ) {
    return;
  }
  const head = Array.from(frame.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ');
  throw new RadioInterlockError(
    `Refused to send ${head || 'an empty frame'}${frame.length > 8 ? '…' : ''}: the pre-flight check only reads the radio's model and version.`,
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

export function createRt95HeadPreflightProbe(
  opts: { retryDelayMs?: number } = {},
): FirmwarePreflightProbe {
  const retryDelayMs = opts.retryDelayMs ?? RT95_PREFLIGHT_RETRY_DELAY_MS;
  return {
    title: 'Check the radio',
    steps: [
      'Switch the radio on normally (no keys held).',
      'Connect the programming cable.',
      'Close CHIRP, the Retevis CPS and other Studio tabs.',
    ],
    link: { ...RT95_HEAD_FW_LINK, baudRate: RT95_BAUD_RATE },
    async run(pipe, runOpts) {
      const guarded = createGuardedSend(pipe, checkRt95PreflightOutgoing);
      // Explicit wrapper: every write goes through the guard. Not a spread of the pipe (it may be a class instance).
      const wrapped: BytePipe = {
        write: guarded,
        readExact: (n, t) => pipe.readExact(n, t),
        flush: pipe.flush ? () => pipe.flush!() : undefined,
        close: () => pipe.close(),
      };

      let entered = false;
      for (let attempt = 0; attempt < RT95_PREFLIGHT_ATTEMPTS && !entered; attempt++) {
        throwIfAborted(runOpts.signal);
        try {
          await enterProgramQxMode(wrapped, RT95_IO_TIMEOUT_MS);
          entered = true;
        } catch (err) {
          if (!(err instanceof RadioTimeoutError)) throw err;
          await wrapped.flush?.();
          if (attempt < RT95_PREFLIGHT_ATTEMPTS - 1) await sleep(retryDelayMs, runOpts.signal);
        }
      }
      if (!entered) {
        throw new RadioNoResponseError(
          `The radio did not answer after ${RT95_PREFLIGHT_ATTEMPTS} tries. Is it switched on normally, with the cable connected? If you just read the radio with Studio, wait a few seconds and try again.`,
        );
      }

      try {
        const raw = await probeProgramQxIdent(wrapped, RT95_IO_TIMEOUT_MS);
        try {
          const ident = parseRt95IdentResponse(raw);
          return { summary: `${ident.model}, version ${ident.version}` };
        } catch (err) {
          if (err instanceof RadioWrongIdentError) {
            throw new RadioWrongIdentError(wrongRadioMessage(raw));
          }
          throw err;
        }
      } finally {
        // Best effort: END leaves clone mode and puts the main board back.
        try {
          await exitProgramQxMode(wrapped);
        } catch {
          /* the port may be gone */
        }
      }
    },
  };
}

function wrongRadioMessage(raw: Uint8Array): string {
  const text = (bytes: Uint8Array) => {
    let s = '';
    for (const b of bytes) {
      if (b === 0) break;
      s += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '?';
    }
    return s.trim();
  };
  const model = text(raw.subarray(1, 8)) || 'an unknown model';
  const version = text(raw.subarray(9, 15)) || 'an unknown version';
  return `This radio reports ${model} ${version}. Studio flashes only the ${RT95_ALLOWED_MODEL} front panel (${RT95_ALLOWED_VERSION}). First-revision radios report RT95. Nothing was written.`;
}

export function createRt95HeadPreflight(
  opts: { retryDelayMs?: number } = {},
): FirmwareRadioPreflight {
  return {
    attestations: [
      {
        id: 'serial-2101',
        label: "My radio's serial number starts 21xx or later.",
        help: 'First-revision RT95 radios (serial before 2101, no VOX) are reported bricked by this firmware, and there is no stock firmware for them.',
      },
      {
        id: 'test-screen-v111',
        label: 'The FUNC + P4 test screen shows LCD CPU V1.11 and RF CPU V1.11.',
        help: 'Back up first. Hold FUNC + P4 while switching on, turn only the knob to read the versions, then switch off. Press no other keys in test mode.',
      },
    ],
    probe: createRt95HeadPreflightProbe(opts),
  };
}

export const RT95_HEAD_PREFLIGHT: FirmwareRadioPreflight = createRt95HeadPreflight();
