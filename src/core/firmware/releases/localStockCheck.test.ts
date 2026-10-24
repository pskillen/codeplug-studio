/**
 * Local-only: applies every published patch to the operator's own stock firmware and checks the result hashes.
 * Set CODEPLUG_FIRMWARE_PUBLIC_REPO to a clone of pskillen/mm9pdy-firmware and CODEPLUG_FIRMWARE_STOCK_DIR to a
 * directory OUTSIDE the repo holding the vendor zips or extracted files. Skipped in CI. Stock bytes are read in memory
 * only and never copied anywhere.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareFirmwareImage } from '../../services/firmware/prepareFirmwareImage.ts';
import { resolveStockFirmware } from '../stock/resolveStockFirmware.ts';
import { getStockFirmwareDescriptor, listStockFirmwareDescriptors } from '../stockCatalog.ts';
import type { NamedBytes } from '../types.ts';
import { parsePublishedReleaseIndex } from './publishedIndex.ts';
import { createPublishedFirmwareReleaseSource } from './publishedSource.ts';

const repo = process.env.CODEPLUG_FIRMWARE_PUBLIC_REPO;
const stockDir = process.env.CODEPLUG_FIRMWARE_STOCK_DIR;

function readStockDir(dir: string): NamedBytes[] {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
    .map((path) => ({ name: path, bytes: new Uint8Array(readFileSync(path)) }));
}

describe.skipIf(!repo || !stockDir)('published releases against local stock firmware', () => {
  const rows = repo
    ? parsePublishedReleaseIndex(JSON.parse(readFileSync(join(repo, 'releases.json'), 'utf8')), {
        loadPatchBytes: async (path) => new Uint8Array(readFileSync(join(repo, path))),
      })
    : [];
  const source = createPublishedFirmwareReleaseSource(async () => rows);

  it.each(rows.map((r) => [`${r.radioId} ${r.tag}`, r] as const))(
    '%s produces its published result',
    async (_name, release) => {
      const descriptor = getStockFirmwareDescriptor(release.radioId);
      const stock = await resolveStockFirmware(descriptor, readStockDir(stockDir!), {
        otherDescriptors: listStockFirmwareDescriptors(),
      });
      const patch = await source.loadPatch(release.radioId, release.tag);
      const prepared = await prepareFirmwareImage({
        descriptor,
        stock,
        target: { kind: 'patch', patch },
      });
      expect(prepared.sha256).toEqual(release.resultSha256);
    },
  );
});
