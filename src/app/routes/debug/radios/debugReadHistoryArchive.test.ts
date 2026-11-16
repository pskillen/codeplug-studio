import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync, Zip, ZipPassThrough } from 'fflate';
import { exampleArchive } from './debugReadHistory.fixture.ts';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { compareDm32Evidence } from '@integrations/radio-io/radios/dm32uv/debugCompare.ts';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';
import {
  buildDebugReadHistoryZip,
  isDebugReadHistoryZip,
  openDebugReadHistoryZip,
} from './debugReadHistoryArchive.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';

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

describe('DM-32 history archive', () => {
  const dm32 = { slug: 'dm-32uv-archive-test', archiveModelId: 'DM-32UV' };
  const capture = (capturedAt: string, fill: number): Dm32DebugCapture => {
    const page = new Uint8Array(4096).fill(fill);
    page[0xfff] = 0x12;
    return {
      capturedAt,
      modelString: 'DP570UV',
      factory: { status: 'not-kept', reason: 'mismatch' },
      vframes: [
        { id: 0x01, status: 'ok', payload: new TextEncoder().encode('DM32.SYN.001') },
        { id: 0x0a, status: 'ok', payload: new Uint8Array([0, 0x10, 0, 0, 0xff, 0x2f, 0, 0]) },
      ],
      rawRange: { start: 0x1000, end: 0x2fff },
      window: { start: 0x1000, end: 0x2000 },
      discovered: [{ address: 0x1000, metadata: 0x12, type: 'channel' }],
      channelCount: 0,
      blocks: new Map([[0x1000, page]]),
    };
  };
  const entries = async () => {
    const store = getDebugReadHistory(dm32);
    store.clear();
    return [
      store.add(await archiveDm32Capture(capture('2026-01-01T00:00:00.000Z', 1))),
      store.add(await archiveDm32Capture(capture('2026-01-02T00:00:00.000Z', 2))),
      store.add(await archiveDm32Capture(capture('2026-01-03T00:00:00.000Z', 3))),
    ];
  };
  it('round-trips child bytes, sidecars, order and times, and still compares', async () => {
    const original = await entries();
    const opened = openDebugReadHistoryZip(buildDebugReadHistoryZip(dm32, original), dm32);
    expect(opened.map((a) => a.zipBytes)).toEqual(original.map((e) => e.archive.zipBytes));
    expect(opened.map((a) => a.manifest.capturedAt)).toEqual(original.map((e) => e.readAt));
    expect(Object.keys(opened[0]!.sidecars).sort()).toEqual(
      Object.keys(original[0]!.archive.sidecars).sort(),
    );
    expect(opened[2]!.regions).toEqual(original[2]!.archive.regions);
    expect(compareDm32Evidence(opened[0]!, opened[1]!).map((r) => [r.field, r.status])).toEqual(
      compareDm32Evidence(original[0]!.archive, original[1]!.archive).map((r) => [
        r.field,
        r.status,
      ]),
    );
  });
  it('fails atomically for a corrupt, truncated, reordered or wrong-profile history', async () => {
    const original = await entries();
    const zip = buildDebugReadHistoryZip(dm32, original);
    expect(() => openDebugReadHistoryZip(zip.slice(0, zip.length - 20), dm32)).toThrow();
    expect(() =>
      openDebugReadHistoryZip(zip, { slug: 'dm-32uv-archive-test', archiveModelId: 'AT-D890UV' }),
    ).toThrow(/model/);
    const files = unzipSync(zip);
    files['reads/000002.zip'] = files['reads/000003.zip']!;
    expect(() => openDebugReadHistoryZip(zipSync(files), dm32)).toThrow(/time/);
    const bad = unzipSync(zip);
    const corrupt = Uint8Array.from(bad['reads/000003.zip']!.subarray(0, 40));
    bad['reads/000003.zip'] = corrupt;
    expect(() => openDebugReadHistoryZip(zipSync(bad), dm32)).toThrow();
    const wrongChild = unzipSync(zip);
    wrongChild['reads/000002.zip'] = Uint8Array.from(
      exampleArchive('2026-01-02T00:00:00.000Z').zipBytes,
    );
    expect(() => openDebugReadHistoryZip(zipSync(wrongChild), dm32)).toThrow();
    const extra = unzipSync(zip);
    extra['reads/000009.zip'] = extra['reads/000001.zip']!;
    expect(() => openDebugReadHistoryZip(zipSync(extra), dm32)).toThrow(/Unexpected/);
  });
  it('rejects a hostile archive with path traversal or a lying index count', async () => {
    const zip = buildDebugReadHistoryZip(dm32, await entries());
    const files = unzipSync(zip);
    const index = JSON.parse(strFromU8(files['history.json']!));
    index.reads.pop();
    files['history.json'] = strToU8(JSON.stringify(index));
    expect(() => openDebugReadHistoryZip(zipSync(files), dm32)).toThrow(/Unexpected/);
    const files2 = unzipSync(zip);
    files2['../escape.zip'] = new Uint8Array([1]);
    expect(() => openDebugReadHistoryZip(zipSync(files2), dm32)).toThrow(/Unexpected/);
    const files3 = unzipSync(zip);
    files3['history.json'] = strToU8('[]');
    expect(() => openDebugReadHistoryZip(zipSync(files3), dm32)).toThrow();
  });
});

describe.each([
  ['dm-1701-opengd77', 'DM-1701'],
  ['md-9600-opengd77', 'MD-9600'],
])('OpenGD77 history archive %s', (slug, model) => {
  it('round-trips and refuses the other OpenGD77 profile', async () => {
    const d = { slug, archiveModelId: model };
    const store = getDebugReadHistory(d);
    store.clear();
    const entries = [
      store.add(await syntheticOpenGd77Archive(model)),
      store.add(await syntheticOpenGd77Archive(model, { capturedAt: '2026-02-01T00:00:00.000Z' })),
    ];
    const zip = buildDebugReadHistoryZip(d, entries);
    expect(isDebugReadHistoryZip(zip)).toBe(true);
    const opened = openDebugReadHistoryZip(zip, d);
    expect(opened.map((a) => a.zipBytes)).toEqual(entries.map((e) => e.archive.zipBytes));
    const other =
      slug === 'dm-1701-opengd77'
        ? { slug: 'md-9600-opengd77', archiveModelId: 'MD-9600' }
        : { slug: 'dm-1701-opengd77', archiveModelId: 'DM-1701' };
    expect(() => openDebugReadHistoryZip(zip, other)).toThrow();
    store.clear();
  });
});
