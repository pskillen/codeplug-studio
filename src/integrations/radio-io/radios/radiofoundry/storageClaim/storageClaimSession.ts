/**
 * RadioFoundry storage claim session: VERSION, INFO_CHIP and STORAGE only, with hard interlocks.
 */

import {
  assertSaneStorageClaimRanges,
  storageClaimRangesFromInfo,
  storageClaimReadChunks,
  STORAGE_CLAIM_POLL_MS,
  STORAGE_CLAIM_POLL_WINDOW_MS,
  type StorageClaimLayout,
  type StorageClaimRange,
} from '@core/radios/radiofoundry/storageClaim.ts';
import { RadioInterlockError, RadioProtocolError } from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe } from '../../../types.ts';
import type { RadioFoundryCableBoard } from '../board.ts';
import { isRadioFoundryBoardName } from '../version.ts';
import { parseRadioFoundryStorageInfo, type RadioFoundryStorageInfo } from '../storageInfo.ts';
import {
  INFO_CHIP_UNAVAILABLE_MESSAGE,
  parseRadioFoundryChipInfo,
  type RadioFoundryChipInfo,
} from './chipInfo.ts';
import { buildStorageClaimTokenPayload, STORAGE_OP_CLAIM } from './storageClaimFrame.ts';
import {
  createStorageClaimSender,
  STORAGE_OP_INFO,
  STORAGE_OP_READ,
  type StorageClaimSender,
} from './storageClaimSend.ts';

export class StorageClaimSessionError extends RadioInterlockError {
  readonly claimSent: boolean;
  constructor(message: string, claimSent: boolean) {
    super(message);
    this.name = 'StorageClaimSessionError';
    this.claimSent = claimSent;
  }
}

function toLayout(info: RadioFoundryStorageInfo): StorageClaimLayout {
  return { ...info };
}

function refuse(message: string, claimSent: boolean): never {
  throw new StorageClaimSessionError(message, claimSent);
}

function rangesEqual(a: StorageClaimLayout, b: StorageClaimLayout): boolean {
  const keys = ['settings', 'journal', 'calibration'] as const;
  for (const k of keys) {
    if (a[k].address !== b[k].address || a[k].size !== b[k].size) return false;
  }
  return a.region === b.region;
}

function encodeReadArgs(address: number, len: number): Uint8Array {
  const args = new Uint8Array(6);
  args[0] = address & 0xff;
  args[1] = (address >>> 8) & 0xff;
  args[2] = (address >>> 16) & 0xff;
  args[3] = (address >>> 24) & 0xff;
  args[4] = len & 0xff;
  args[5] = (len >>> 8) & 0xff;
  return args;
}

export interface StorageClaimSessionState {
  board: RadioFoundryCableBoard;
  sender: StorageClaimSender;
  /** Last successful STORAGE INFO in this session (status 0). */
  storageInfo: StorageClaimLayout | null;
  backupSaved: boolean;
  /** Token and layout from the backup step manifest. */
  manifestToken: number | null;
  manifestLayout: StorageClaimLayout | null;
}

export function createStorageClaimSession(
  pipe: BytePipe,
  board: RadioFoundryCableBoard,
): StorageClaimSessionState {
  return {
    board,
    sender: createStorageClaimSender(pipe),
    storageInfo: null,
    backupSaved: false,
    manifestToken: null,
    manifestLayout: null,
  };
}

export interface StorageClaimCheckResult {
  layout: StorageClaimLayout;
  boardReported: string;
  firmwareGit: string;
  ranges: StorageClaimRange[];
}

/** Step 1: VERSION + STORAGE INFO only. Refuses ours / none / no map before any READ or CLAIM. */
export async function storageClaimCheck(
  state: StorageClaimSessionState,
  signal?: AbortSignal,
): Promise<StorageClaimCheckResult> {
  throwIfAborted(signal);
  const version = await state.sender.exchangeVersion(signal);
  const boardReported = version?.board?.trim() ?? '';
  if (!boardReported || !isRadioFoundryBoardName(state.board, boardReported)) {
    refuse(
      `This radio reports board "${boardReported || 'unknown'}", not one of ${state.board.label}. Nothing has changed.`,
      state.sender.claimSent,
    );
  }
  const infoReply = await state.sender.exchangeStorage(
    STORAGE_OP_INFO,
    new Uint8Array(),
    2000,
    signal,
  );
  if (infoReply.status === 4) {
    refuse(
      'This RadioFoundry firmware has no settings storage map for this radio. Nothing has changed.',
      state.sender.claimSent,
    );
  }
  if (infoReply.status === 1) {
    refuse(
      'This RadioFoundry build does not support STORAGE. Nothing has changed.',
      state.sender.claimSent,
    );
  }
  if (infoReply.status !== 0 || infoReply.body.length < 26) {
    refuse(
      'Could not read storage layout from the radio. Nothing has changed.',
      state.sender.claimSent,
    );
  }
  const parsed = parseRadioFoundryStorageInfo(infoReply.body);
  const layout = toLayout(parsed);
  state.storageInfo = layout;
  if (layout.region === 'ours') {
    refuse('Storage already belongs to RadioFoundry. Nothing to do.', state.sender.claimSent);
  }
  if (layout.region !== 'foreign') {
    refuse(
      'Storage is not in the foreign state Studio can claim. Nothing has changed.',
      state.sender.claimSent,
    );
  }
  const ranges = storageClaimRangesFromInfo(layout);
  assertSaneStorageClaimRanges(ranges);
  return {
    layout,
    boardReported,
    firmwareGit: version?.git ?? 'unknown',
    ranges,
  };
}

export interface StorageClaimBackupResult {
  layout: StorageClaimLayout;
  chip: RadioFoundryChipInfo;
  ranges: Readonly<Record<string, Uint8Array>>;
}

/** Read every non-zero range twice, INFO_CHIP for token; refuses on mismatch or unavailable chip. */
export async function storageClaimBackup(
  state: StorageClaimSessionState,
  signal?: AbortSignal,
): Promise<StorageClaimBackupResult> {
  if (!state.storageInfo || state.storageInfo.region !== 'foreign') {
    refuse('Read storage check first: region must still be foreign.', state.sender.claimSent);
  }
  const ranges = storageClaimRangesFromInfo(state.storageInfo);
  assertSaneStorageClaimRanges(ranges);
  const chipReply = await state.sender.exchangeInfoChip(signal);
  if (chipReply.status === 4) {
    refuse(INFO_CHIP_UNAVAILABLE_MESSAGE, state.sender.claimSent);
  }
  if (chipReply.status !== 0) {
    refuse("Could not read the radio's chip ID. Nothing has changed.", state.sender.claimSent);
  }
  const chip = parseRadioFoundryChipInfo(chipReply.body);
  const out: Record<string, Uint8Array> = {};
  for (const range of ranges) {
    const first = await readRangeFull(state, range, signal);
    const second = await readRangeFull(state, range, signal);
    if (first.length !== second.length || !bytesEqual(first, second)) {
      refuse(
        `Backup of ${range.kind} at 0x${range.address.toString(16)} did not match on the second read. Nothing has changed.`,
        state.sender.claimSent,
      );
    }
    out[range.kind] = first;
  }
  state.manifestToken = chip.token;
  state.manifestLayout = { ...state.storageInfo };
  return { layout: state.storageInfo, chip, ranges: out };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

async function readRangeFull(
  state: StorageClaimSessionState,
  range: StorageClaimRange,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const chunks = storageClaimReadChunks(range.size);
  const buf = new Uint8Array(range.size);
  let offset = 0;
  for (const len of chunks) {
    throwIfAborted(signal);
    const args = encodeReadArgs(range.address + offset, len);
    const reply = await state.sender.exchangeStorage(STORAGE_OP_READ, args, 5000, signal);
    if (reply.status !== 0) {
      throw new RadioProtocolError(`STORAGE READ failed with status ${reply.status}.`);
    }
    if (reply.body.length < 4 + len) {
      throw new RadioProtocolError('STORAGE READ reply was too short.');
    }
    const echo =
      reply.body[0]! | (reply.body[1]! << 8) | (reply.body[2]! << 16) | (reply.body[3]! << 24);
    if (echo >>> 0 !== (range.address + offset) >>> 0) {
      throw new RadioProtocolError('STORAGE READ echoed the wrong address.');
    }
    buf.set(reply.body.subarray(4, 4 + len), offset);
    offset += len;
  }
  return buf;
}

export function storageClaimAcknowledgeBackupSaved(state: StorageClaimSessionState): void {
  state.backupSaved = true;
}

/** Fresh INFO + CHIP, then the single CLAIM for this session. */
export async function storageClaimUnlock(
  state: StorageClaimSessionState,
  signal?: AbortSignal,
): Promise<void> {
  if (!state.backupSaved) {
    refuse(
      'Confirm you have saved the backup file before unlocking storage.',
      state.sender.claimSent,
    );
  }
  if (state.manifestToken == null || state.manifestLayout == null) {
    refuse('Complete the backup step before unlocking storage.', state.sender.claimSent);
  }
  const infoReply = await state.sender.exchangeStorage(
    STORAGE_OP_INFO,
    new Uint8Array(),
    2000,
    signal,
  );
  if (infoReply.status !== 0 || infoReply.body.length < 26) {
    refuse(
      'Could not re-read storage layout before claim. Nothing has changed.',
      state.sender.claimSent,
    );
  }
  const fresh = toLayout(parseRadioFoundryStorageInfo(infoReply.body));
  if (fresh.region !== 'foreign' || !rangesEqual(fresh, state.manifestLayout)) {
    refuse(
      'Storage layout changed since the backup; unlock refused. Nothing has changed.',
      state.sender.claimSent,
    );
  }
  state.storageInfo = fresh;
  const chipReply = await state.sender.exchangeInfoChip(signal);
  if (chipReply.status === 4) {
    refuse(INFO_CHIP_UNAVAILABLE_MESSAGE, state.sender.claimSent);
  }
  if (chipReply.status !== 0) {
    refuse('Could not read chip ID before claim. Nothing has changed.', state.sender.claimSent);
  }
  const chip = parseRadioFoundryChipInfo(chipReply.body);
  if (chip.token !== state.manifestToken) {
    refuse(
      `Chip token ${chip.token.toString(16)} does not match the backup manifest (${state.manifestToken!.toString(16)}). Nothing has changed.`,
      state.sender.claimSent,
    );
  }
  const claimPayload = buildStorageClaimTokenPayload(chip.token);
  const claimReply = await state.sender.exchangeStorage(
    STORAGE_OP_CLAIM,
    claimPayload.subarray(1),
    5000,
    signal,
  );
  if (claimReply.status !== 0) {
    refuse(
      `The radio refused storage claim (status ${claimReply.status}). Nothing has changed.`,
      true,
    );
  }
}

export type StorageClaimPollResult =
  | { kind: 'ours' }
  | { kind: 'timeout'; last: StorageClaimLayout }
  | { kind: 'still-foreign'; last: StorageClaimLayout };

/** STORAGE INFO every 500 ms for up to 20 s; only op 0 after CLAIM. */
export async function storageClaimPollForOurs(
  state: StorageClaimSessionState,
  signal?: AbortSignal,
): Promise<StorageClaimPollResult> {
  if (!state.sender.claimSent) {
    refuse('Send CLAIM before polling for ours.', false);
  }
  const end = performance.now() + STORAGE_CLAIM_POLL_WINDOW_MS;
  let last = state.storageInfo;
  while (performance.now() < end) {
    throwIfAborted(signal);
    await delay(STORAGE_CLAIM_POLL_MS);
    const infoReply = await state.sender.exchangeStorage(
      STORAGE_OP_INFO,
      new Uint8Array(),
      2000,
      signal,
    );
    if (infoReply.status !== 0 || infoReply.body.length < 26) continue;
    const layout = toLayout(parseRadioFoundryStorageInfo(infoReply.body));
    last = layout;
    state.storageInfo = layout;
    if (layout.region === 'ours') return { kind: 'ours' };
  }
  if (last?.region === 'foreign') return { kind: 'still-foreign', last };
  return { kind: 'timeout', last: last ?? state.storageInfo! };
}

/** INFO-only poll from Done "Check again". */
export async function storageClaimRecheck(
  state: StorageClaimSessionState,
  signal?: AbortSignal,
): Promise<StorageClaimLayout> {
  const infoReply = await state.sender.exchangeStorage(
    STORAGE_OP_INFO,
    new Uint8Array(),
    2000,
    signal,
  );
  if (infoReply.status !== 0 || infoReply.body.length < 26) {
    throw new RadioProtocolError('STORAGE INFO failed during recheck.');
  }
  const layout = toLayout(parseRadioFoundryStorageInfo(infoReply.body));
  state.storageInfo = layout;
  return layout;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
