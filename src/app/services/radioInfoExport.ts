/**
 * Download ephemeral radio-clone read payloads for support — no project persistence.
 */

import { zipSync } from 'fflate';
import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  radioCloneImageBytes,
  radioCloneSparseBlockBytes,
} from '@core/models/radioCloneHydration.ts';
import {
  downloadBinaryFile,
  downloadZip,
  isoTimestampForFilename,
} from '@integrations/download/browserDownload.ts';

export function downloadEphemeralRadioCloneHydration(bag: RadioCloneHydrationBag): void {
  const modelId = bag.retain.radioModelId.replace(/[^\w.-]+/g, '_');
  const stamp = isoTimestampForFilename();
  const sparse = radioCloneSparseBlockBytes(bag);

  if (sparse.length > 0) {
    const files: Record<string, Uint8Array> = {};
    for (const block of sparse) {
      const addr = block.address.toString(16).toUpperCase().padStart(8, '0');
      files[`block-0x${addr}.bin`] = block.data;
    }
    files['hydration.json'] = new TextEncoder().encode(JSON.stringify(bag, null, 2));
    downloadZip(zipSync(files), `radio-clone-${modelId}-${stamp}.zip`);
    return;
  }

  const bytes = radioCloneImageBytes(bag);
  downloadBinaryFile(bytes, `radio-clone-${modelId}-${stamp}.img`);
}
