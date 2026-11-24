/**
 * RadioFoundry storage claim: the only guarded debug-link sender for VERSION, INFO_CHIP and STORAGE.
 */

import type { RadioFoundryBuildIdentity } from '@core/radios/radiofoundry/firmware.ts';
import {
  decodeDebugFrame,
  encodeDebugFrame,
  type DebugFrame,
} from '../../../kit/codecs/radioFoundryDebugLink.ts';
import {
  RadioInterlockError,
  RadioProtocolError,
  RadioTimeoutError,
} from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe } from '../../../types.ts';
import { CODEPLUG_COMMAND } from '../constants.ts';
import { RADIOFOUNDRY_STORAGE_COMMAND } from '../storageInfo.ts';
import { RADIOFOUNDRY_VERSION_COMMAND, parseRadioFoundryVersionText } from '../version.ts';
import { assertStorageClaimPayload, STORAGE_OP_CLAIM } from './storageClaimFrame.ts';
import { RADIOFOUNDRY_INFO_CHIP_COMMAND } from './chipInfo.ts';

export const STORAGE_OP_INFO = 0;
export const STORAGE_OP_READ = 1;

const STORAGE_BUSY_RETRY_MS = 2000;
const STORAGE_BUSY_GAP_MS = 20;
const VERSION_TIMEOUT_MS = 2000;
const CHIP_TIMEOUT_MS = 2000;
const STORAGE_READ_TIMEOUT_MS = 5000;
const CLAIM_TIMEOUT_MS = 5000;

/** The only STORAGE operations this sender may emit. */
export const STORAGE_CLAIM_ALLOWED_STORAGE_OPS: ReadonlySet<number> = new Set([0, 1, 2]);

export class StorageClaimSendRefusedError extends RadioInterlockError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageClaimSendRefusedError';
  }
}

function refuse(message: string): never {
  throw new StorageClaimSendRefusedError(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readDebugFrame(pipe: BytePipe, timeoutMs: number): Promise<DebugFrame> {
  const started = Date.now();
  const remaining = (): number => {
    const left = timeoutMs - (Date.now() - started);
    if (left <= 0) throw new RadioTimeoutError();
    return left;
  };
  let prev = 0;
  for (;;) {
    const b = (await pipe.readExact(1, remaining()))[0]!;
    if (prev === 0xa5 && b === 0x5a) break;
    prev = b;
  }
  const head = await pipe.readExact(4, remaining());
  const len = head[2]! | (head[3]! << 8);
  if (len > 1024) throw new RadioProtocolError('RadioFoundry debug reply is too long.');
  const rest = await pipe.readExact(len + 2, remaining());
  const frame = new Uint8Array(8 + len);
  frame[0] = 0xa5;
  frame[1] = 0x5a;
  frame.set(head, 2);
  frame.set(rest, 6);
  try {
    return decodeDebugFrame(frame);
  } catch {
    throw new RadioProtocolError('RadioFoundry debug reply CRC does not match.');
  }
}

/** Refuse before `pipe.write` when the command or payload is outside the allow-list. */
export function guardStorageClaimCommand(command: number, payload: Uint8Array): void {
  if (command === CODEPLUG_COMMAND) {
    refuse('Storage claim must not send CODEPLUG (0x1C).');
  }
  if (command === RADIOFOUNDRY_VERSION_COMMAND) {
    if (payload.length !== 0) refuse('VERSION must have an empty payload.');
    return;
  }
  if (command === RADIOFOUNDRY_INFO_CHIP_COMMAND) {
    if (payload.length !== 0) refuse('INFO_CHIP must have an empty payload.');
    return;
  }
  if (command === RADIOFOUNDRY_STORAGE_COMMAND) {
    if (payload.length < 1) refuse('STORAGE requests need an op byte.');
    const op = payload[0]!;
    if (!STORAGE_CLAIM_ALLOWED_STORAGE_OPS.has(op)) {
      refuse(`Studio does not send RadioFoundry STORAGE operation ${op}.`);
    }
    if (op === STORAGE_OP_CLAIM) assertStorageClaimPayload(payload);
    if (op === STORAGE_OP_READ) {
      if (payload.length !== 7 || payload[0] !== STORAGE_OP_READ) {
        refuse('STORAGE READ must be exactly 7 bytes: op, addr u32 LE, len u16 LE.');
      }
      const len = payload[5]! | (payload[6]! << 8);
      if (len < 1 || len > 1000) {
        refuse('STORAGE READ length must be 1..1000.');
      }
    }
    if (payload.length > 64) refuse('RadioFoundry debug request payload is longer than 64 bytes.');
    return;
  }
  refuse(`Studio does not send debug-link command 0x${command.toString(16)} during storage claim.`);
}

export interface StorageClaimExchangeResult {
  status: number;
  body: Uint8Array;
}

export interface StorageClaimSender {
  readonly claimSent: boolean;
  exchangeVersion(signal?: AbortSignal): Promise<RadioFoundryBuildIdentity | null>;
  exchangeInfoChip(signal?: AbortSignal): Promise<StorageClaimExchangeResult>;
  exchangeStorage(
    op: number,
    args: Uint8Array,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<StorageClaimExchangeResult>;
}

export function createStorageClaimSender(pipe: BytePipe, startSeq = 1): StorageClaimSender {
  let seq = startSeq & 0xff;
  let claimSent = false;

  async function exchange(
    command: number,
    payload: Uint8Array,
    timeoutMs: number,
    busyRetryMs: number,
    signal?: AbortSignal,
  ): Promise<StorageClaimExchangeResult> {
    guardStorageClaimCommand(command, payload);
    if (command === RADIOFOUNDRY_STORAGE_COMMAND && payload[0] === STORAGE_OP_CLAIM && claimSent) {
      refuse('This session has already sent STORAGE CLAIM.');
    }
    throwIfAborted(signal);
    const busyUntil = performance.now() + busyRetryMs;
    const replyCmd = command | 0x80;
    for (;;) {
      throwIfAborted(signal);
      const frameSeq = seq;
      seq = (seq + 1) & 0xff;
      await pipe.write(encodeDebugFrame(command, frameSeq, payload));
      const frame = await readDebugFrame(pipe, timeoutMs);
      if (frame.command !== replyCmd || frame.seq !== frameSeq || frame.payload.length < 1) {
        throw new RadioProtocolError('Unexpected RadioFoundry debug reply during storage claim.');
      }
      const status = frame.payload[0]!;
      if (status === 3 && performance.now() < busyUntil) {
        await delay(STORAGE_BUSY_GAP_MS);
        continue;
      }
      if (command === RADIOFOUNDRY_STORAGE_COMMAND && payload[0] === STORAGE_OP_CLAIM && status === 0) {
        claimSent = true;
      }
      return { status, body: frame.payload.subarray(1) };
    }
  }

  return {
    get claimSent() {
      return claimSent;
    },
    async exchangeVersion(signal) {
      const result = await exchange(
        RADIOFOUNDRY_VERSION_COMMAND,
        new Uint8Array(0),
        VERSION_TIMEOUT_MS,
        0,
        signal,
      );
      if (result.status !== 0) return null;
      return parseRadioFoundryVersionText(new TextDecoder().decode(result.body));
    },
    exchangeInfoChip(signal) {
      return exchange(
        RADIOFOUNDRY_INFO_CHIP_COMMAND,
        new Uint8Array(0),
        CHIP_TIMEOUT_MS,
        0,
        signal,
      );
    },
    exchangeStorage(op, args, timeoutMs, signal) {
      const payload = new Uint8Array(1 + args.length);
      payload[0] = op;
      payload.set(args, 1);
      const ms =
        op === STORAGE_OP_READ
          ? STORAGE_READ_TIMEOUT_MS
          : op === STORAGE_OP_CLAIM
            ? CLAIM_TIMEOUT_MS
            : timeoutMs;
      return exchange(RADIOFOUNDRY_STORAGE_COMMAND, payload, ms, STORAGE_BUSY_RETRY_MS, signal);
    },
  };
}