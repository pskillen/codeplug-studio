/**
 * Upload AT-D890UV digital contact bank after codeplug Write (#992, #1406).
 *
 * Two steps so every check that can throw runs before the first `W` of the session:
 * {@link prepareAtD890DigitalContactsForWrite} packs and validates (call it before
 * `session.radio.upload`), {@link writePreparedAtD890DigitalContactsForWrite} sends.
 */

import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  prepareAtD890DigitalContactWrite,
  writePreparedAtD890DigitalContacts,
  type AtD890PreparedContactWrite,
} from '@integrations/radio-io/radios/at-d890uv/digitalContactWrite.ts';
import type { RadioDigitalContactDto } from '@integrations/radio-io/radioWriteProjection.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';

/** Pack and validate the contacts without touching the radio. `undefined` when not writing contacts. */
export function prepareAtD890DigitalContactsForWrite(
  digitalContacts: readonly RadioDigitalContactDto[] | undefined,
): AtD890PreparedContactWrite | undefined {
  return digitalContacts === undefined
    ? undefined
    : prepareAtD890DigitalContactWrite(digitalContacts);
}

/**
 * Send prepared contacts. A failure or cancel leaves PROGRAM without `END` (#1406): `END` would
 * commit the main image plus a truncated contact database.
 */
export async function writePreparedAtD890DigitalContactsForWrite(
  session: RadioSession,
  prepared: AtD890PreparedContactWrite | undefined,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  if (prepared === undefined) return;
  try {
    await writePreparedAtD890DigitalContacts(session.pipe, prepared, {
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });
  } catch (err) {
    if (session.radio instanceof AtD890uvProtocol) session.radio.abandonProgramMode();
    throw err;
  }
}

export async function uploadAtD890DigitalContactsForWrite(
  session: RadioSession,
  digitalContacts: readonly RadioDigitalContactDto[] | undefined,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  await writePreparedAtD890DigitalContactsForWrite(
    session,
    prepareAtD890DigitalContactsForWrite(digitalContacts),
    opts,
  );
}
