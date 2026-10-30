/**
 * The bytes a cable write may send: the same image as `codeplug.bin`, plus the
 * mask of addresses that serialiser stored.
 */

import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { serialiseRadioFoundryCodeplug } from '@core/import-export/formats/radiofoundry/serialise.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';

export interface Dm32RadioFoundryWriteSource {
  bytes: Uint8Array;
  owned: Uint8Array;
  warnings: ExportWarning[];
}

export function radioFoundryWriteSourceFromAssembled(
  assembled: AssembledBuild,
): Dm32RadioFoundryWriteSource {
  const image = serialiseRadioFoundryCodeplug(assembled);
  return { bytes: image.bytes, owned: image.owned, warnings: image.warnings };
}
