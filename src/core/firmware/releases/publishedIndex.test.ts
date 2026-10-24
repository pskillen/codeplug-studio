import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../errors.ts';
import { syntheticDm32Release } from './__fixtures__/syntheticReleases.ts';
import { parsePublishedReleaseIndex } from './publishedIndex.ts';

async function indexFor() {
  const { row, descriptor, patchBytes } = await syntheticDm32Release();
  const entry = {
    radioId: row.radioId,
    version: row.tag,
    channel: row.channel,
    patchName: row.patchName,
    patchFile: row.patchFile,
    patchPath: `releases/${row.radioId}/${row.patchFile}`,
    patchSha256: row.patchSha256,
    stockVersion: descriptor.version,
    publishedOn: row.publishedOn,
    summary: row.summary,
    verifyHint: row.verifyHint,
    resultSha256: row.resultSha256,
    notesPath: `releases/${row.radioId}/${row.patchFile}.md`,
    notes: 'Some notes.\n',
  };
  const requested: string[] = [];
  const opts = {
    descriptors: [descriptor],
    loadPatchBytes: async (path: string) => {
      requested.push(path);
      return patchBytes;
    },
  };
  return { entry, opts, requested, row };
}

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(FirmwareError);
    return (e as FirmwareError).message;
  }
  throw new Error('expected a refusal');
}

describe('parsePublishedReleaseIndex', () => {
  it('turns an index row into a release that downloads by its path', async () => {
    const { entry, opts, requested, row } = await indexFor();
    const [release] = parsePublishedReleaseIndex({ format: 1, releases: [entry] }, opts);
    expect(release).toMatchObject({
      radioId: row.radioId,
      tag: row.tag,
      channel: 'final',
      patchSha256: row.patchSha256,
      resultSha256: row.resultSha256,
    });
    expect(await release!.loadNotes()).toBe('Some notes.\n');
    await release!.loadBytes();
    expect(requested).toEqual([entry.patchPath]);
  });

  it('skips radios Studio does not know and other stock versions', async () => {
    const { entry, opts } = await indexFor();
    const rows = parsePublishedReleaseIndex(
      {
        format: 1,
        releases: [
          { ...entry, radioId: 'acme-future-radio' },
          { ...entry, stockVersion: 'v9.99' },
        ],
      },
      opts,
    );
    expect(rows).toEqual([]);
  });

  it('refuses an unknown format, bad fields, paths outside the radio and duplicates', async () => {
    const { entry, opts } = await indexFor();
    expect(messageOf(() => parsePublishedReleaseIndex({ format: 2, releases: [] }, opts))).toMatch(
      /unknown format/,
    );
    const bad = (patch: Record<string, unknown>) =>
      messageOf(() =>
        parsePublishedReleaseIndex({ format: 1, releases: [{ ...entry, ...patch }] }, opts),
      );
    expect(bad({ channel: 'rc' })).toMatch(/bad channel/);
    expect(bad({ patchSha256: 'abc' })).toMatch(/bad patch hash/);
    expect(bad({ patchPath: '../../etc/passwd' })).toMatch(/bad patch path/);
    expect(bad({ patchPath: 'releases/anytone-at-d890uv/x.patch.json' })).toMatch(/bad patch path/);
    expect(bad({ patchName: 'anytone-d890-firmware' })).toMatch(/not this radio's project/);
    expect(bad({ resultSha256: { bin: 'nope' } })).toMatch(/bad result hashes/);
    expect(bad({ summary: '' })).toMatch(/no summary/);
    expect(
      messageOf(() => parsePublishedReleaseIndex({ format: 1, releases: [entry, entry] }, opts)),
    ).toMatch(/listed twice/);
  });
});
