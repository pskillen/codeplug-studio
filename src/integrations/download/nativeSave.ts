/**
 * Saving a file in the Android app — integrations layer.
 *
 * The app's WebView ignores `<a download>` on a `blob:` URL, so `downloadBlob` (browserDownload.ts) sends every save
 * here on native. The file is written to the phone's public `Documents/Codeplug Studio/` folder (no storage permission
 * on Android 11 and later; the app sees only the files it wrote), then the share sheet opens on it so it can be sent
 * off the phone. Where `Documents` can't be written (Android 10 and earlier, which would need a storage permission the
 * app doesn't ask for), the file goes to the app's cache and the share sheet is the way to keep it.
 *
 * The outcome is published to `subscribeNativeSaves` listeners so the app shell can say where the file went.
 */
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** The folder under the phone's `Documents` that saved files go to. */
export const NATIVE_SAVE_FOLDER = 'Codeplug Studio';

/**
 * Raw bytes per bridge call. Each call carries its chunk as base64 in one bridge message, so a large file goes in
 * several (one write, then appends) rather than one message the size of the whole file.
 */
export const NATIVE_SAVE_CHUNK_BYTES = 3 * 1024 * 1024;

type NativeDirectory = Directory.Documents | Directory.Cache;

/** The slice of `@capacitor/filesystem` the save uses (a fake stands in for it in tests). */
export interface NativeSaveFilesystem {
  writeFile(options: {
    path: string;
    data: string;
    directory: NativeDirectory;
    recursive?: boolean;
  }): Promise<{ uri: string }>;
  appendFile(options: { path: string; data: string; directory: NativeDirectory }): Promise<void>;
}

/** The slice of `@capacitor/share` the save uses. */
export interface NativeSaveShare {
  share(options: { title?: string; files?: string[]; dialogTitle?: string }): Promise<unknown>;
}

export interface NativeSaveDeps {
  filesystem: NativeSaveFilesystem;
  share: NativeSaveShare;
  /** Raw bytes per bridge call; `NATIVE_SAVE_CHUNK_BYTES` unless a test sets it. */
  chunkBytes?: number;
}

export interface NativeSaveResult {
  fileName: string;
  /** `documents`: the phone's Documents folder; `cache`: the app's cache, kept only through the share sheet. */
  place: 'documents' | 'cache';
  /** Where to look for it, in the words a phone's Files app uses. */
  displayPath: string;
  uri: string;
}

export type NativeSaveEvent =
  | { status: 'saved'; result: NativeSaveResult }
  | { status: 'failed'; fileName: string; message: string };

type Listener = (event: NativeSaveEvent) => void;
const listeners = new Set<Listener>();

/** Hear about every save on native (the app shell's notice). Returns the unsubscribe. */
export function subscribeNativeSaves(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(event: NativeSaveEvent): void {
  for (const listener of listeners) listener(event);
}

const defaultDeps: NativeSaveDeps = {
  filesystem: Filesystem as unknown as NativeSaveFilesystem,
  share: Share,
};

/** A file name that stays one path segment. */
export function nativeSafeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/]/g, '-').trim();
  return cleaned === '' ? 'download' : cleaned;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

async function writeInChunks(
  deps: NativeSaveDeps,
  bytes: Uint8Array,
  path: string,
  directory: NativeDirectory,
): Promise<string> {
  const chunk = deps.chunkBytes ?? NATIVE_SAVE_CHUNK_BYTES;
  const { uri } = await deps.filesystem.writeFile({
    path,
    data: bytesToBase64(bytes.subarray(0, chunk)),
    directory,
    recursive: true,
  });
  for (let at = chunk; at < bytes.length; at += chunk) {
    await deps.filesystem.appendFile({
      path,
      data: bytesToBase64(bytes.subarray(at, at + chunk)),
      directory,
    });
  }
  return uri;
}

/**
 * Write the blob to `Documents/Codeplug Studio/`, or to the app's cache when that fails. Throws only when no copy
 * could be written.
 */
export async function writeBlobOnDevice(
  blob: Blob,
  fileName: string,
  deps: NativeSaveDeps = defaultDeps,
): Promise<NativeSaveResult> {
  const name = nativeSafeFileName(fileName);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    const uri = await writeInChunks(
      deps,
      bytes,
      `${NATIVE_SAVE_FOLDER}/${name}`,
      Directory.Documents,
    );
    return {
      fileName: name,
      place: 'documents',
      displayPath: `Documents/${NATIVE_SAVE_FOLDER}/${name}`,
      uri,
    };
  } catch {
    const uri = await writeInChunks(deps, bytes, name, Directory.Cache);
    return { fileName: name, place: 'cache', displayPath: name, uri };
  }
}

/** Open the share sheet on a saved file. A cancelled or failed share leaves the file where it is. */
export async function shareSavedFile(
  result: NativeSaveResult,
  deps: NativeSaveDeps = defaultDeps,
): Promise<void> {
  try {
    await deps.share.share({
      title: result.fileName,
      files: [result.uri],
      dialogTitle:
        result.place === 'documents'
          ? `Saved to ${result.displayPath}`
          : `Keep or send ${result.fileName}`,
    });
  } catch {
    // Cancelled, or nothing to share to: the file is already written.
  }
}

/**
 * Save on the device, tell the listeners where it went, then open the share sheet on it. Never throws: a failure is
 * published as a `failed` event.
 */
export async function saveBlobOnDevice(
  blob: Blob,
  fileName: string,
  deps: NativeSaveDeps = defaultDeps,
): Promise<NativeSaveEvent> {
  let event: NativeSaveEvent;
  try {
    event = { status: 'saved', result: await writeBlobOnDevice(blob, fileName, deps) };
  } catch (err) {
    event = {
      status: 'failed',
      fileName: nativeSafeFileName(fileName),
      message: err instanceof Error ? err.message : String(err),
    };
  }
  publish(event);
  if (event.status === 'saved') await shareSavedFile(event.result, deps);
  return event;
}
