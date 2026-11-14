import { describe, expect, it } from 'vitest';

import { createFakeNativeSave } from './__fixtures__/fakeNativeSavePlugins.ts';
import {
  NATIVE_SAVE_CHUNK_BYTES,
  nativeSafeFileName,
  saveBlobOnDevice,
  subscribeNativeSaves,
  type NativeSaveEvent,
} from './nativeSave.ts';

function bytesOf(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (i * 31 + 7) & 0xff;
  return out;
}

describe('saveBlobOnDevice', () => {
  it('writes the file to Documents/Codeplug Studio, reports where, then opens the share sheet on it', async () => {
    const fake = createFakeNativeSave();
    const events: NativeSaveEvent[] = [];
    const sharesAtEvent: number[] = [];
    const unsubscribe = subscribeNativeSaves((event) => {
      events.push(event);
      sharesAtEvent.push(fake.shares.length);
    });
    const content = 'flash log\n';

    const event = await saveBlobOnDevice(new Blob([content]), 'flash-log.txt', fake);
    unsubscribe();

    expect(event).toEqual({
      status: 'saved',
      result: {
        fileName: 'flash-log.txt',
        place: 'documents',
        displayPath: 'Documents/Codeplug Studio/flash-log.txt',
        uri: 'file:///fake/DOCUMENTS/Codeplug Studio/flash-log.txt',
      },
    });
    expect(events).toEqual([event]);
    // The notice goes out before the share sheet, which can stay open.
    expect(sharesAtEvent).toEqual([0]);
    expect(
      new TextDecoder().decode(fake.files.get('DOCUMENTS:Codeplug Studio/flash-log.txt')),
    ).toBe(content);
    expect(fake.shares).toEqual([
      {
        title: 'flash-log.txt',
        files: ['file:///fake/DOCUMENTS/Codeplug Studio/flash-log.txt'],
        dialogTitle: 'Saved to Documents/Codeplug Studio/flash-log.txt',
      },
    ]);
  });

  it('writes a large file in chunks and keeps every byte', async () => {
    const fake = createFakeNativeSave();
    const bytes = bytesOf(1000 * 2 + 123);

    await saveBlobOnDevice(new Blob([bytes]), 'reads.zip', { ...fake, chunkBytes: 1000 });

    expect(fake.chunkSizes).toEqual([1000, 1000, 123]);
    expect(fake.files.get('DOCUMENTS:Codeplug Studio/reads.zip')).toEqual(bytes);
  });

  it('sends a full read zip (3 MiB) in one-chunk-per-3-MiB bridge calls', async () => {
    const fake = createFakeNativeSave();
    const size = NATIVE_SAVE_CHUNK_BYTES + 1;

    await saveBlobOnDevice(new Blob([new Uint8Array(size)]), 'reads.zip', fake);

    expect(fake.chunkSizes).toEqual([NATIVE_SAVE_CHUNK_BYTES, 1]);
    expect(fake.files.get('DOCUMENTS:Codeplug Studio/reads.zip')?.length).toBe(size);
  }, 30_000);

  it('falls back to the app cache and the share sheet when Documents is refused', async () => {
    const fake = createFakeNativeSave({ refuse: ['DOCUMENTS'] });

    const event = await saveBlobOnDevice(new Blob([bytesOf(10)]), 'backup.zip', fake);

    expect(event.status).toBe('saved');
    if (event.status !== 'saved') return;
    expect(event.result.place).toBe('cache');
    expect(fake.files.get('CACHE:backup.zip')).toEqual(bytesOf(10));
    expect(fake.shares[0]).toMatchObject({
      files: ['file:///fake/CACHE/backup.zip'],
      dialogTitle: 'Keep or send backup.zip',
    });
  });

  it('keeps the saved file when the share sheet is cancelled', async () => {
    const fake = createFakeNativeSave({ shareRejects: true });

    const event = await saveBlobOnDevice(new Blob(['x']), 'a.txt', fake);

    expect(event.status).toBe('saved');
    expect(fake.files.has('DOCUMENTS:Codeplug Studio/a.txt')).toBe(true);
  });

  it('reports a failure, and opens no share sheet, when nothing could be written', async () => {
    const fake = createFakeNativeSave({ refuse: ['DOCUMENTS', 'CACHE'] });
    const events: NativeSaveEvent[] = [];
    const unsubscribe = subscribeNativeSaves((event) => events.push(event));

    const event = await saveBlobOnDevice(new Blob(['x']), 'a.txt', fake);
    unsubscribe();

    expect(event).toEqual({
      status: 'failed',
      fileName: 'a.txt',
      message: 'Permission denied: CACHE',
    });
    expect(events).toEqual([event]);
    expect(fake.shares).toEqual([]);
  });
});

describe('nativeSafeFileName', () => {
  it('keeps the name one path segment', () => {
    expect(nativeSafeFileName('a/b\\c.txt')).toBe('a-b-c.txt');
    expect(nativeSafeFileName('  ')).toBe('download');
    expect(nativeSafeFileName('uv5r-mini-reads-2026-11-14T10-00-00-000Z.zip')).toBe(
      'uv5r-mini-reads-2026-11-14T10-00-00-000Z.zip',
    );
  });
});
