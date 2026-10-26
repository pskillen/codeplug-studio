/**
 * Upload AT-D890UV digital contact bank after codeplug Write (#992).
 */

import { uploadAtD890DigitalContacts } from '@integrations/radio-io/radios/at-d890uv/digitalContactWrite.ts';
import type { RadioDigitalContactDto } from '@integrations/radio-io/radioWriteProjection.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';

export async function uploadAtD890DigitalContactsForWrite(
  session: RadioSession,
  digitalContacts: readonly RadioDigitalContactDto[] | undefined,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  if (digitalContacts === undefined) return;
  await uploadAtD890DigitalContacts(session.pipe, digitalContacts, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
}
