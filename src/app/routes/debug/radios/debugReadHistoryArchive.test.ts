import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync, Zip, ZipPassThrough } from 'fflate';
import { exampleArchive } from './debugReadHistory.fixture.ts';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { buildDebugReadHistoryZip, openDebugReadHistoryZip } from './debugReadHistoryArchive.ts';

const descriptor = { slug: 'archive-test', archiveModelId: 'AT-D890UV' };
describe('history archive', () => {
  it('preserves order, bytes, sidecars and capture times', () => {
    const store = getDebugReadHistory(descriptor);
    store.clear();
    const original = [
      store.add(exampleArchive()),
      store.add(exampleArchive('2026-02-01T00:00:00Z')),
    ];
    const opened = openDebugReadHistoryZip(
      buildDebugReadHistoryZip(descriptor, original),
      descriptor,
    );
    expect(opened.map((archive) => archive.zipBytes)).toEqual(
      original.map((entry) => entry.archive.zipBytes),
    );
    expect(opened.map((archive) => archive.manifest.capturedAt)).toEqual(
      original.map((entry) => entry.readAt),
    );
    expect(opened[0]?.sidecars['debug/test.bin']).toEqual(new Uint8Array([3]));
    expect(opened.every((archive) => archive.source === 'file')).toBe(true);
  });
  it('rejects mismatched, corrupt and unexpected entries', () => {
    const store = getDebugReadHistory(descriptor);
    store.clear();
    const zip = buildDebugReadHistoryZip(descriptor, [store.add(exampleArchive())]);
    expect(() => openDebugReadHistoryZip(zip, { ...descriptor, slug: 'other' })).toThrow(/model/);
    const files = unzipSync(zip);
    files['reads/000001.zip'] = new Uint8Array([1]);
    expect(() => openDebugReadHistoryZip(zipSync(files), descriptor)).toThrow();
    const changed = unzipSync(zip);
    const index = JSON.parse(strFromU8(changed['history.json']!));
    index.reads[0].path = '../bad.zip';
    changed['history.json'] = strToU8(JSON.stringify(index));
    expect(() => openDebugReadHistoryZip(zipSync(changed), descriptor)).toThrow(/path/);
  });
  it('rejects duplicate ZIP entry names before reading the index', () => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((error, data) => {
      if (error) throw error;
      chunks.push(data);
    });
    for (let i = 0; i < 2; i++) {
      const file = new ZipPassThrough('history.json');
      zip.add(file);
      file.push(strToU8('{}'), true);
    }
    zip.end();
    const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    expect(() => openDebugReadHistoryZip(bytes, descriptor)).toThrow(/Duplicate/);
  });
});
