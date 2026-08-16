import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { ingestRadioidUserDump } from './ingestUserDump.ts';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const sampleCsv = readFileSync(join(fixtureDir, 'fixtures/user-dump.sample.csv'), 'utf8');

function csvResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/csv', 'Content-Length': String(body.length) },
  });
}

describe('ingestRadioidUserDump', () => {
  it('writes valid rows without hydrating the full directory partition', async () => {
    const persistence = new InMemoryProjectPersistence();
    const listSpy = vi.spyOn(persistence, 'listDigitalIdDirectoryEntries');
    const progress: number[] = [];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(csvResponse(sampleCsv)));

    const result = await ingestRadioidUserDump({
      projectId: 'p1',
      persistence,
      url: 'https://example.test/user.csv',
      onProgress: (p) => progress.push(p.written),
    });

    expect(result).toMatchObject({
      written: 2,
      skipped: 1,
      failed: 0,
      cancelled: false,
      error: null,
    });
    expect(listSpy).not.toHaveBeenCalled();

    const page = await persistence.queryDigitalIdDirectoryPage({
      projectId: 'p1',
      offset: 0,
      limit: 10,
      orderBy: 'digitalId',
    });
    expect(page.total).toBe(2);
    expect(page.rows.map((row) => row.digitalId)).toEqual([1023007, 9999999]);
    expect(progress.at(-1)).toBe(2);

    vi.unstubAllGlobals();
  });

  it('stops writing when aborted', async () => {
    const persistence = new InMemoryProjectPersistence();
    const controller = new AbortController();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        controller.abort();
        return csvResponse(sampleCsv);
      }),
    );

    const result = await ingestRadioidUserDump({
      projectId: 'p1',
      persistence,
      url: 'https://example.test/user.csv',
      signal: controller.signal,
      onProgress: () => {},
    });

    expect(result.cancelled).toBe(true);

    vi.unstubAllGlobals();
  });
});
