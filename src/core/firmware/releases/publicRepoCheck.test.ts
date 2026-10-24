/**
 * Local-only: every release in a clone of the public release repository (pskillen/mm9pdy-firmware) parses and
 * passes the checks Studio runs before a flash. Set CODEPLUG_FIRMWARE_PUBLIC_REPO to the clone. Skipped in CI: the
 * public repository is the source of truth and Studio fetches it at run time.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import { parsePublishedReleaseIndex } from './publishedIndex.ts';
import { createPublishedFirmwareReleaseSource } from './publishedSource.ts';

const repo = process.env.CODEPLUG_FIRMWARE_PUBLIC_REPO;

describe.skipIf(!repo)('public release repository', () => {
  const index: unknown = repo ? JSON.parse(readFileSync(join(repo, 'releases.json'), 'utf8')) : {};
  const rows = repo
    ? parsePublishedReleaseIndex(index, {
        loadPatchBytes: async (path) => new Uint8Array(readFileSync(join(repo, path))),
      })
    : [];
  const source = createPublishedFirmwareReleaseSource(async () => rows);

  it('lists every row and at least one final per radio', () => {
    expect(rows.length).toBe((index as { releases: unknown[] }).releases.length);
    for (const d of listStockFirmwareDescriptors()) {
      expect(
        rows.some((r) => r.radioId === d.radioId && r.channel === 'final'),
        d.radioId,
      ).toBe(true);
    }
  });

  it.each(rows.map((r) => [`${r.radioId} ${r.tag}`, r] as const))(
    '%s passes the pre-flash checks and has notes',
    async (_name, release) => {
      const loaded = await source.loadPatch(release.radioId, release.tag);
      expect(loaded.provenance).toBe('published');
      expect((await release.loadNotes()).trim().length).toBeGreaterThan(0);
    },
  );
});
