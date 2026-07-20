import { zipSync, strToU8 } from 'fflate';
import { NEONPLUG_JSON_FILE_NAME } from './serialise.ts';

/**
 * Package NeonPlug export files into a `.neonplug` ZIP.
 * NeonPlug requires a single entry named exactly `codeplug.json`.
 */
export function buildNeonplugZip(files: Record<string, string>): Uint8Array {
  const json = files[NEONPLUG_JSON_FILE_NAME];
  if (json == null) {
    throw new Error(`NeonPlug ZIP requires entry "${NEONPLUG_JSON_FILE_NAME}"`);
  }
  return zipSync({
    [NEONPLUG_JSON_FILE_NAME]: strToU8(json),
  });
}
