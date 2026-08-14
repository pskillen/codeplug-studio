/**
 * OpenGD77 satellite keps upload (#858).
 *
 * Does not reuse full-codeplug `upload()` (that encodes modelled channels and keeps
 * additional-settings untouched). Talks to {@link OpenGd77Protocol.uploadSatelliteBank}.
 */

import type { ProgressFn } from '../../types.ts';
import { OpenGd77Protocol } from './protocol.ts';

export async function uploadOpenGd77SatelliteBank(
  radio: OpenGd77Protocol,
  bank: Uint8Array,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<void> {
  await radio.uploadSatelliteBank(bank, opts);
}
