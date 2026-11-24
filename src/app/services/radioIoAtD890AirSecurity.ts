/**
 * AT-D890UV AirSecurity seed: read whether one is set, and write or clear it on its own.
 *
 * MM9PDY target only. One patch covers `0x03500220..0x0350023F` and nothing else. The encoded
 * record and the patch bytes are zeroed before the function returns; the caller's seed is not.
 */

import { isMm9pdyAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import {
  AIRSECURITY_SEED_ADDRESS,
  AIRSECURITY_SEED_CLEAR_RECORD,
  AIRSECURITY_SEED_FIELD_ID,
  AIRSECURITY_SEED_RECORD_LENGTH,
  airSecuritySeedRecordIsSet,
  encodeAirSecuritySeedRecord,
} from '@integrations/radio-io/radios/at-d890uv/airSecuritySeed.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import type { AtD890SettingsPatch } from '@integrations/radio-io/radios/at-d890uv/settingsFields.ts';
import type { WriteVerifyCaptureResult } from '@integrations/radio-io/writeVerify.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';

function requireAtD890(session: RadioSession): AtD890uvProtocol {
  if (!(session.radio instanceof AtD890uvProtocol)) {
    throw new RadioWriteBlockedError('Connected radio is not an AT-D890UV.');
  }
  return session.radio;
}

/**
 * Read the seed record and report whether it is set. The bytes are zeroed before this returns.
 */
export async function readAtD890AirSecuritySeedSet(
  session: RadioSession,
  opts?: { signal?: AbortSignal },
): Promise<boolean> {
  const radio = requireAtD890(session);
  const record = await radio.readAirSecuritySeedRecord(opts);
  const set = airSecuritySeedRecordIsSet(record);
  record.fill(0);
  return set;
}

export interface WriteAtD890AirSecuritySeedResult {
  /** Feed to the Verify write step, as after a settings-only Write. */
  writeVerifyPending?: WriteVerifyCaptureResult;
}

/**
 * Write `seed`, or clear the record when `seed` is null. Refuses a target that is not the
 * MM9PDY AT-D890UV before any read. One full-mask patch; the encoded record is zeroed afterwards.
 */
export async function writeAtD890AirSecuritySeed(
  session: RadioSession,
  egress: EgressPath,
  seed: Uint8Array | null,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<WriteAtD890AirSecuritySeedResult> {
  if (!isMm9pdyAtD890RadioIoProfileId(egress.profileId)) {
    throw new RadioWriteBlockedError(
      'The AirSecurity seed can only be written to an MM9PDY AT-D890UV.',
    );
  }
  const radio = requireAtD890(session);
  const record =
    seed === null ? AIRSECURITY_SEED_CLEAR_RECORD.slice() : encodeAirSecuritySeedRecord(seed);
  const patch: AtD890SettingsPatch = {
    fieldId: AIRSECURITY_SEED_FIELD_ID,
    address: AIRSECURITY_SEED_ADDRESS,
    bytes: record,
    mask: new Uint8Array(AIRSECURITY_SEED_RECORD_LENGTH).fill(0xff),
  };
  try {
    await radio.uploadSettingsPatches([patch], {
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });
    const captured = session.descriptor.writeVerify?.captureAfterUpload(session);
    return captured ? { writeVerifyPending: captured } : {};
  } finally {
    record.fill(0);
    patch.bytes.fill(0);
  }
}
