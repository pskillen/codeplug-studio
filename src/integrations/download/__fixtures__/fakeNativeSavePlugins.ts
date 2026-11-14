/**
 * Test-only stand-ins for `@capacitor/filesystem` and `@capacitor/share` as the Android app's save uses them. The
 * filesystem keeps each written file's bytes (decoded from the base64 the bridge carries) per directory and path, and
 * can refuse one directory, as Android 10 refuses `Documents` without a storage permission. The share sheet records
 * what it was opened on and can be told to reject, as a cancelled sheet does.
 */
import type { NativeSaveDeps, NativeSaveFilesystem, NativeSaveShare } from '../nativeSave.ts';

export interface FakeNativeSaveOptions {
  /** Directories whose writes fail (e.g. `'DOCUMENTS'`). */
  refuse?: string[];
  /** The share sheet rejects (the user cancelled). */
  shareRejects?: boolean;
}

export interface FakeNativeSave extends NativeSaveDeps {
  /** `<directory>:<path>` → the file's bytes. */
  files: Map<string, Uint8Array>;
  /** Every bridge call's raw byte count, in order (write then appends). */
  chunkSizes: number[];
  shares: Parameters<NativeSaveShare['share']>[0][];
}

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function createFakeNativeSave(options: FakeNativeSaveOptions = {}): FakeNativeSave {
  const files = new Map<string, Uint8Array>();
  const chunkSizes: number[] = [];
  const shares: FakeNativeSave['shares'] = [];
  const refuse = new Set(options.refuse ?? []);

  const filesystem: NativeSaveFilesystem = {
    async writeFile({ path, data, directory }) {
      if (refuse.has(directory)) throw new Error(`Permission denied: ${directory}`);
      const bytes = decode(data);
      chunkSizes.push(bytes.length);
      files.set(`${directory}:${path}`, bytes);
      return { uri: `file:///fake/${directory}/${path}` };
    },
    async appendFile({ path, data, directory }) {
      if (refuse.has(directory)) throw new Error(`Permission denied: ${directory}`);
      const key = `${directory}:${path}`;
      const before = files.get(key);
      if (!before) throw new Error(`No such file: ${key}`);
      const bytes = decode(data);
      chunkSizes.push(bytes.length);
      const joined = new Uint8Array(before.length + bytes.length);
      joined.set(before);
      joined.set(bytes, before.length);
      files.set(key, joined);
    },
  };

  const share: NativeSaveShare = {
    async share(opts) {
      shares.push(opts);
      if (options.shareRejects) throw new Error('Share canceled');
      return {};
    },
  };

  return { filesystem, share, files, chunkSizes, shares };
}
