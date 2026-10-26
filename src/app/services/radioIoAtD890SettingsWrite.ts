/**
 * AT-D890UV radio settings: read them, and write them on their own (#1393).
 *
 * No UI trigger yet: these are service functions, exercised by tests only, like
 * `radioIoAtD890SatelliteWrite.ts`.
 *
 * ## Design decision: does NOT reuse `session.radio.upload()` for the codeplug
 *
 * A settings-only Write must not need a Download and must not stage any codeplug bank, so it
 * calls `AtD890uvProtocol.uploadSettingsPatches`. That method runs the same erase-unit
 * read-modify-write core as the codeplug Write (fresh read, plausibility checks, marker filter,
 * transmit fence), limited to erase unit `0x3500000`, and applies each override as a field patch
 * on the fresh read. It never replays a stored image, and it is not Restore's region replay.
 *
 * Session setup is unchanged: `connect()` has already entered PROGRAM mode and
 * `closeRadioSession()` exits it.
 */

import { isMm9pdyAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  resolveAtD890SettingsPatches,
  type AtD890RadioSettingsSnapshot,
  type AtD890SettingsOverride,
} from '@integrations/radio-io/radios/at-d890uv/settingsFields.ts';
import { formatAtD890LocalInfoSerial } from '@integrations/radio-io/radios/at-d890uv/identityCheck.ts';
import { decodeWideCharName } from '@integrations/radio-io/radios/at-d890uv/wideChar.ts';
import type { WriteVerifyCaptureResult } from '@integrations/radio-io/writeVerify.ts';
import {
  RadioWriteBlockedError,
  RadioWriteCancelledError,
  type AtD890PreTransmitContext,
  type AtD890PreTransmitDecision,
} from './radioIoSession.ts';

function requireAtD890(session: RadioSession): AtD890uvProtocol {
  if (!(session.radio instanceof AtD890uvProtocol)) {
    throw new RadioWriteBlockedError('Connected radio is not an AT-D890UV.');
  }
  return session.radio;
}

/** Read the settings spans from the connected radio: four reads, nothing else. */
export async function readAtD890RadioSettings(
  session: RadioSession,
  opts?: { signal?: AbortSignal },
): Promise<AtD890RadioSettingsSnapshot> {
  return requireAtD890(session).readSettingsSnapshot(opts);
}

export interface WriteAtD890SettingsOnlyResult {
  /** Feed to the Verify write step, as after a codeplug Write. */
  writeVerifyPending?: WriteVerifyCaptureResult;
}

/**
 * Write only the settings overrides. Reads the settings first and offers them to
 * `beforeTransmit`; `'apply'` writes, `'keep'` and `'cancel'` both stop before any frame (there is
 * no codeplug to keep writing), and a missing callback cancels.
 */
export async function writeAtD890SettingsOnly(
  session: RadioSession,
  egress: EgressPath,
  overrides: readonly AtD890SettingsOverride[],
  opts?: {
    beforeTransmit?: (ctx: AtD890PreTransmitContext) => Promise<AtD890PreTransmitDecision>;
    onProgress?: ProgressFn;
    signal?: AbortSignal;
  },
): Promise<WriteAtD890SettingsOnlyResult> {
  if (overrides.length === 0) {
    throw new RadioWriteBlockedError('There are no radio settings to write.');
  }
  const radio = requireAtD890(session);
  const target = isMm9pdyAtD890RadioIoProfileId(egress.profileId) ? 'mm9pdy' : 'stock';
  // Refused overrides fail here, before the read and before any frame.
  const patches = resolveAtD890SettingsPatches(overrides, target);

  const snapshot = await radio.readSettingsSnapshot({ signal: opts?.signal });
  const decision = opts?.beforeTransmit
    ? await opts.beforeTransmit({
        serial: formatAtD890LocalInfoSerial(snapshot.localInfo),
        masterIdName: decodeWideCharName(snapshot.masterId.subarray(4, 0x24)),
        snapshot,
        overrides,
        target,
      })
    : 'cancel';
  if (decision !== 'apply') throw new RadioWriteCancelledError();

  await radio.uploadSettingsPatches(patches, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  const captured = session.descriptor.writeVerify?.captureAfterUpload(session);
  return captured ? { writeVerifyPending: captured } : {};
}
