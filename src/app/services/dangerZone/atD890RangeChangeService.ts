/**
 * AT-D890UV "Change frequency range" application service (Danger zone, #1369).
 *
 * Three kinds of session, each opened by the caller with `openRadioSessionForEgress`:
 *
 * - **A** (held, nothing written until the end): identify, the full backup and the vital backup, then
 *   `changeRange`: read, guard, ONE `W`, `END`. No `R` frame follows the `W`.
 * - **B** (after the radio restarted): `verifyAfterChange`, then `restoreAfterChange`, which writes every
 *   restorable region (codeplug and settings together, in one session), then `END`.
 * - **C** (read only): `checkRestored`.
 *
 * This file is the only app caller of `changeAtD890FrequencyRange`. It never imports the sender or the range
 * extent (the `rangeChange/` boundary test enforces that). Whether `END` may follow a failure is asked of
 * `atD890RangeChangeMayEndAfter`, which fails closed.
 */

import {
  atD890MaintenanceUnlocked,
  listAtD890ReceiveOnlyChannels,
} from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import type { RadioBackupManifestV1 } from '@integrations/radio-io/backup/index.ts';
import type { MemoryMap, ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AtD890PendingUnitsError } from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  AtD890StunKillError,
  assertAtD890NoStunKill,
} from '@integrations/radio-io/radios/at-d890uv/stunKillGuard.ts';
import {
  AtD890RangeChangeRefusedError,
  AtD890RangeChangeSessionError,
  atD890RangeChangeMayEndAfter,
  changeAtD890FrequencyRange,
  verifyAtD890RangeChange,
  type AtD890RangeChangeVerifyResult,
} from '@integrations/radio-io/radios/at-d890uv/rangeChange/index.ts';
import {
  parseAtD890VitalZip,
  sha256Hex,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackupZip.ts';
import { AtD890VitalMismatchError } from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import {
  atD890VitalFileName,
  backupAtD890Vital,
  downloadAtD890VitalZip,
  type AtD890VitalSession,
} from '../atD890VitalBackup.ts';
import {
  defaultRestorableRegionIds,
  downloadRadioBackupZip,
  openRadioBackupZip,
  packAtD890BackupFromSession,
  radioBackupFileName,
  restoreRadioBackup,
  type RadioBackupSession,
} from '../radioBackupRestore.ts';
import { closeRadioSession, readAtD890ConnectedRadioIdentity } from '../radioIoSession.ts';
import { checkAtD890RestoredRegions, type RestoreCheckResult } from './atD890RestoreCheck.ts';

const LOCAL_INFO_RANGE_OFFSET = 0x03;
const MODEL_OFFSET = 0x10;
const MODEL_ASCII = 'D890UV';
const TUNE_BYTES = 0x2000;

/** What the radio said about itself in session A or B. */
export interface RangeChangeRadio {
  /** Full serial from LocalInfo. */
  serial: string;
  firmware?: string;
  label: string;
  /** The sanitised code, from ident byte 8: what the radio enforces. */
  identCode: number;
  /** The raw LocalInfo `+0x03`, which the frame is built from. */
  rawCode: number;
  maintenanceUnlocked: boolean;
  /** LocalInfo, 0x100 bytes. */
  localInfo: Uint8Array;
}

export type RangeChangeRefusalCode =
  'not-d890' | 'blank-serial' | 'identity-wrong' | 'reads-differ' | 'serial-mismatch';

/** Studio refuses to carry on. Nothing has been written. */
export class RangeChangeRefusedError extends Error {
  readonly code: RangeChangeRefusalCode;
  constructor(code: RangeChangeRefusalCode, message: string) {
    super(message);
    this.name = 'RangeChangeRefusedError';
    this.code = code;
  }
}

function d890(session: RadioSession): AtD890uvProtocol {
  if (!(session.radio instanceof AtD890uvProtocol)) {
    throw new RangeChangeRefusedError('not-d890', 'This is not an AT-D890UV.');
  }
  return session.radio;
}

function modelOk(localInfo: Uint8Array): boolean {
  const text = new TextDecoder('ascii').decode(localInfo.subarray(MODEL_OFFSET, MODEL_OFFSET + 6));
  return text === MODEL_ASCII;
}

/**
 * Session A or B: who is this radio. Throws {@link AtD890StunKillError} first when a flag is set (the caller
 * then closes without `END`), then {@link RangeChangeRefusedError}.
 */
export async function identifyRangeChangeRadio(
  session: RadioSession,
  opts?: { signal?: AbortSignal },
): Promise<RangeChangeRadio> {
  const radio = d890(session);
  const { serial, localInfo } = await readAtD890ConnectedRadioIdentity(session, opts);
  assertAtD890NoStunKill(localInfo);
  if (!modelOk(localInfo)) {
    throw new RangeChangeRefusedError('identity-wrong', 'The radio’s identity looks wrong.');
  }
  if (serial.trim() === '') {
    throw new RangeChangeRefusedError('blank-serial', 'The radio’s serial number is blank.');
  }
  return {
    serial: serial.trim(),
    firmware: radio.getDownloadCache()?.firmware,
    label: session.descriptor.label,
    identCode: radio.getIdentBandCode(),
    rawCode: localInfo[LOCAL_INFO_RANGE_OFFSET]!,
    maintenanceUnlocked: atD890MaintenanceUnlocked(localInfo),
    localInfo: localInfo.slice(0, D890_MAP.LocalInfoLength),
  };
}

/**
 * May the caller send `END` after this failure in session A, before the frame? Only when the failure came after
 * LocalInfo was read and checked for a stun/kill flag (a refusal on the bytes, or two reads that disagree).
 * Everything else, an unreadable LocalInfo above all, leaves the stun/kill state unknown, and `END` would
 * rewrite LocalInfo from stale RAM if a flag was set: no `END`, as the engine does. Fails closed.
 */
export function rangeChangeMayEndAfterRead(err: unknown): boolean {
  return err instanceof RangeChangeRefusedError || err instanceof AtD890VitalMismatchError;
}

/** What step 3 produced: both files, as bytes, with what the journal and the later checks need. */
export interface RangeChangeBackupPair {
  backup: RadioBackupSession;
  vital: AtD890VitalSession;
  backupFileName: string;
  vitalFileName: string;
  backupSha256: string;
  vitalSha256: string;
  savedAt: string;
  serial: string;
  /** LocalInfo from the vital read (read twice), 0x100 bytes. */
  localInfo: Uint8Array;
  /** The live tune bank from the vital read, 0x2000 bytes. */
  tune: Uint8Array;
}

/**
 * Session A, step 3: the full backup (the Backup page's `download()` and pack) and the vital backup (read
 * twice). Nothing is saved to disk here; the caller saves both with {@link saveRangeChangeBackupPair}.
 */
export async function backupForRangeChange(
  session: RadioSession,
  opts: {
    onProgress?: ProgressFn;
    onPhase?: (phase: 'codeplug' | 'vital') => void;
    signal?: AbortSignal;
  },
): Promise<RangeChangeBackupPair> {
  d890(session);
  opts.onPhase?.('codeplug');
  await session.radio.download({ onProgress: opts.onProgress, signal: opts.signal });
  const backup = packAtD890BackupFromSession(session);
  opts.onPhase?.('vital');
  const vital = await backupAtD890Vital(session, {
    onProgress: opts.onProgress,
    signal: opts.signal,
    download: false,
  });

  const vitalLocalInfoBytes = await localInfoFromVital(vital);
  const backupLocalInfo = backup.image.get(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
  assertAtD890NoStunKill(vitalLocalInfoBytes);
  if (!modelOk(vitalLocalInfoBytes)) {
    throw new RangeChangeRefusedError('identity-wrong', 'The radio’s identity looks wrong.');
  }
  const serial = vital.serial.trim();
  if (serial === '' || (backup.manifest.serial ?? '') !== serial) {
    throw new RangeChangeRefusedError('blank-serial', 'The radio’s serial number is unreadable.');
  }
  if (!sameBytes(vitalLocalInfoBytes, backupLocalInfo)) {
    throw new RangeChangeRefusedError(
      'reads-differ',
      'The backup and the vital read of the radio disagree.',
    );
  }
  const tune = await tuneFromVital(vital);
  return {
    backup,
    vital,
    backupFileName: radioBackupFileName(backup.manifest),
    vitalFileName: atD890VitalFileName(vital.manifest),
    backupSha256: await sha256Hex(backup.zipBytes),
    vitalSha256: await sha256Hex(vital.zipBytes),
    savedAt: new Date().toISOString(),
    serial,
    localInfo: vitalLocalInfoBytes,
    tune,
  };
}

async function unitFromVital(vital: AtD890VitalSession, id: string): Promise<Uint8Array> {
  const parsed = await parseAtD890VitalZip(vital.zipBytes);
  const unit = parsed.units[id];
  if (!unit) throw new RangeChangeRefusedError('reads-differ', `The vital file has no ${id} unit.`);
  return unit;
}

async function localInfoFromVital(vital: AtD890VitalSession): Promise<Uint8Array> {
  return (await unitFromVital(vital, 'local-info')).slice(0, D890_MAP.LocalInfoLength);
}

async function tuneFromVital(vital: AtD890VitalSession): Promise<Uint8Array> {
  return (await unitFromVital(vital, 'tune-a')).slice(0, TUNE_BYTES);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Save both files together. Call again for "Save again". */
export function saveRangeChangeBackupPair(pair: RangeChangeBackupPair): void {
  downloadRadioBackupZip(pair.backup.zipBytes, pair.backup.manifest);
  downloadAtD890VitalZip(pair.vital);
}

/**
 * How many of the backup's channels will be receive-only on `target` (their transmit frequency is outside the
 * target's transmit range). From the backup's channels, so it needs no radio traffic. `null` when the channels
 * cannot be decoded.
 */
export function receiveOnlyAfterChange(
  session: RadioSession,
  pair: Pick<RangeChangeBackupPair, 'backup'>,
  target: number,
): { count: number; total: number } | null {
  try {
    const channels = d890(session).decodeChannels(pair.backup.image);
    const used = channels.filter((c) => !c.empty);
    return { count: listAtD890ReceiveOnlyChannels(used, target).length, total: used.length };
  } catch {
    return null;
  }
}

// ---- Session A: the change ------------------------------------------------------------------------------

export type RangeChangeOutcome =
  /** The `W` was ACKed and `END` sent (or `END` failed after a clean ACK). The radio restarts. */
  | { kind: 'changed'; endConfirmed: boolean }
  /** Nothing was written. `END` was sent. */
  | { kind: 'nothing-changed'; reason: 'radio-changed' | 'refused'; detail: string }
  /** A stun or kill flag. Nothing was written, and no `END` was sent. */
  | { kind: 'stun-kill'; detail: string }
  /** LocalInfo could not be read, so the state is unknown. Nothing was written; no `END`. */
  | { kind: 'unreadable'; detail: string }
  /** The `W` was not ACKed. No `END`: the radio keeps its old range. */
  | { kind: 'not-taken'; detail: string }
  /** Anything else. The journal, if written, stays; no `END`. */
  | { kind: 'unknown'; detail: string };

/**
 * Session A, step 5. Re-reads LocalInfo, compares it with the backup, calls `onBeforeSend` (the caller writes its
 * `sending` journal there), sends the one `W` and `END`. Closes the session itself, with `END` only when
 * {@link atD890RangeChangeMayEndAfter} allows it.
 */
export async function changeRange(
  session: RadioSession,
  opts: {
    backupLocalInfo: Uint8Array;
    target: number;
    onBeforeSend: () => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<RangeChangeOutcome> {
  const radio = d890(session);
  let outcome: RangeChangeOutcome;
  let mayEnd = false;
  try {
    await changeAtD890FrequencyRange(session.pipe, opts);
    outcome = { kind: 'changed', endConfirmed: true };
  } catch (err) {
    mayEnd = atD890RangeChangeMayEndAfter(err);
    outcome = classify(err);
  }
  // `changeAtD890FrequencyRange` already sent END on success. Everything else: END only when it is safe.
  if (!(outcome.kind === 'nothing-changed' && mayEnd)) radio.abandonProgramMode();
  await closeRadioSession(session).catch(() => undefined);
  return outcome;
}

function classify(err: unknown): RangeChangeOutcome {
  const detail = err instanceof Error ? err.message : String(err);
  if (err instanceof AtD890StunKillError) return { kind: 'stun-kill', detail };
  // An interrupted Write is pending (#1406): nothing was sent, and no END (it would commit that Write).
  if (err instanceof AtD890PendingUnitsError) {
    return { kind: 'nothing-changed', reason: 'refused', detail };
  }
  if (err instanceof AtD890RangeChangeRefusedError) {
    if (err.reason === 'stun-kill-flag') return { kind: 'stun-kill', detail };
    if (err.reason === 'short-local-info') return { kind: 'unreadable', detail };
    return { kind: 'nothing-changed', reason: 'refused', detail };
  }
  if (err instanceof AtD890RangeChangeSessionError) {
    switch (err.failure) {
      case 'read-failed':
        return { kind: 'unreadable', detail };
      case 'local-info-changed':
        return { kind: 'nothing-changed', reason: 'radio-changed', detail };
      case 'before-send-failed':
      case 'send-refused':
        return { kind: 'nothing-changed', reason: 'refused', detail };
      case 'send-failed':
        return { kind: 'not-taken', detail };
      case 'end-failed':
        return { kind: 'changed', endConfirmed: false };
    }
  }
  return { kind: 'unknown', detail };
}

// ---- Session B: verify and restore ----------------------------------------------------------------------

export type PostChangeOutcome =
  | { kind: 'ok'; result: AtD890RangeChangeVerifyResult }
  /** A different radio. */
  | { kind: 'wrong-radio'; serial: string }
  /** Still the old range, LocalInfo as in the backup: the change did not take and nothing was wiped. */
  | { kind: 'not-taken'; result: AtD890RangeChangeVerifyResult }
  /** The range is neither the old nor the target code. */
  | { kind: 'unexpected-range'; code: number; result: AtD890RangeChangeVerifyResult }
  /** The range is right but LocalInfo or the tune bank differs elsewhere. */
  | { kind: 'identity-differs'; result: AtD890RangeChangeVerifyResult };

/**
 * Session B, after the reboot. Read only. `backupTune` is optional (resume without the vital file skips the tune
 * comparison). `target` is the code the change aimed for; resume without a journal passes the ident's own code.
 */
export async function verifyAfterChange(
  session: RadioSession,
  opts: {
    serial: string;
    backupLocalInfo: Uint8Array;
    backupTune?: Uint8Array;
    target: number;
    signal?: AbortSignal;
  },
): Promise<PostChangeOutcome> {
  const radio = d890(session);
  const result = await verifyAtD890RangeChange(
    session.pipe,
    {
      identBandCode: radio.getIdentBandCode(),
      backupLocalInfo: opts.backupLocalInfo,
      backupTune: opts.backupTune,
      target: opts.target,
    },
    opts.signal,
  );
  if (!result.serialMatches) {
    const live = await readAtD890ConnectedRadioIdentity(session, { signal: opts.signal });
    return { kind: 'wrong-radio', serial: live.serial.trim() };
  }
  const clean = result.localInfoDiffs.length === 0 && result.tuneDiffs.length === 0;
  if (result.rangeIsOld && result.localInfoDiffs.length === 0) {
    return { kind: 'not-taken', result };
  }
  if (!result.rangeIsTarget) {
    return { kind: 'unexpected-range', code: radio.getIdentBandCode(), result };
  }
  return clean ? { kind: 'ok', result } : { kind: 'identity-differs', result };
}

/**
 * Session B, step 7: every restorable region of the zip, codeplug and settings together, then `END` (the session
 * is closed here). Restoring the settings alone onto the still-default codeplug would leave the radio at
 * "Program Error", so there is never a smaller set.
 */
export async function restoreAfterChange(
  session: RadioSession,
  archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
  opts: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<{ regionIds: string[] }> {
  const regionIds = defaultRestorableRegionIds(archive.manifest);
  try {
    await restoreRadioBackup(session, archive, {
      regionIds,
      onProgress: opts.onProgress,
      signal: opts.signal,
    });
  } catch (err) {
    await closeRadioSession(session).catch(() => undefined);
    throw err;
  }
  await closeRadioSession(session);
  return { regionIds };
}

// ---- Session C: check ----------------------------------------------------------------------------------

/** Session C, read only. Closes the session itself (a read session ends with `END`). */
export async function checkRestored(
  session: RadioSession,
  archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
  opts: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<RestoreCheckResult> {
  const radio = d890(session);
  try {
    const live = await readAtD890ConnectedRadioIdentity(session, { signal: opts.signal });
    if (archive.manifest.serial && live.serial.trim() !== archive.manifest.serial.trim()) {
      throw new RangeChangeRefusedError('serial-mismatch', 'This is not the radio you changed.');
    }
    return await checkAtD890RestoredRegions(session.pipe, archive, {
      readBlockSize: radio.getNegotiatedReadBlockSize(),
      onProgress: opts.onProgress,
      signal: opts.signal,
    });
  } finally {
    await closeRadioSession(session).catch(() => undefined);
  }
}

/** Open the zip the user saved. Convenience for resume. */
export { openRadioBackupZip };
