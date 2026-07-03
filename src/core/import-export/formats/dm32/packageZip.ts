import { zipSync, strToU8 } from 'fflate';

/** Build a ZIP archive from named UTF-8 text files (DM32 CPS CSV export). */
export function buildDm32Zip(files: Record<string, string>): Uint8Array {
  const zipEntries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    zipEntries[name] = strToU8(content);
  }
  return zipSync(zipEntries);
}
