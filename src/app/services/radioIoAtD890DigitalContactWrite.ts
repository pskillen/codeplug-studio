/**
 * Upload AT-D890UV digital contact bank after codeplug Write (#992).
 */

import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { uploadAtD890DigitalContacts } from '@integrations/radio-io/radios/at-d890uv/digitalContactWrite.ts';
import { AT_D890_BLOCK_SIZE } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import type { RadioDigitalContactDto } from '@integrations/radio-io/radioWriteProjection.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';

export async function uploadAtD890DigitalContactsForWrite(
  session: RadioSession,
  digitalContacts: readonly RadioDigitalContactDto[] | undefined,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  if (digitalContacts === undefined) return;
  const readBlockSize =
    session.radio instanceof AtD890uvProtocol
      ? session.radio.getNegotiatedReadBlockSize()
      : AT_D890_BLOCK_SIZE;
  await uploadAtD890DigitalContacts(session.pipe, digitalContacts, {
    readBlockSize,
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
}
