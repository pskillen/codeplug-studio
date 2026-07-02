import { zipSync, strToU8 } from 'fflate';

/** Build a ZIP archive from named UTF-8 text files (CPS CSV export). */
export function buildOpenGd77Zip(files: Record<string, string>): Uint8Array {
  const zipEntries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    zipEntries[name] = strToU8(content);
  }
  return zipSync(zipEntries);
}
