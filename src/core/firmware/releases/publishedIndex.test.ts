import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../errors.ts';
import {
  syntheticDm32Release,
  syntheticUv5rMiniRelease,
} from './__fixtures__/syntheticReleases.ts';
import { parsePublishedReleaseIndex } from './publishedIndex.ts';
import type { PublishedFirmwareRelease } from './types.ts';

/** The index entry for a synthetic row. */
function entryOf(row: PublishedFirmwareRelease) {
  return {
    radioId: row.radioId,
    version: row.tag,
    channel: row.channel,
    patchName: row.patchName,
    patchFile: row.patchFile,
    patchPath: `releases/${row.radioId}/${row.patchFile}`,
    patchSha256: row.patchSha256,
    stockVersion: row.stockVersion,
    ...(row.layout ? { layout: row.layout } : {}),
    publishedOn: row.publishedOn,
    summary: row.summary,
    verifyHint: row.verifyHint,
    resultSha256: row.resultSha256,
  };
}

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

describe('parsePublishedReleaseIndex: one row per flash layout', () => {
  async function mini() {
    const l1 = await syntheticUv5rMiniRelease({ layout: 'L1' });
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const dm32 = await syntheticDm32Release();
    const opts = {
      descriptors: [l1.descriptor, dm32.descriptor],
      loadPatchBytes: async () => new Uint8Array(0),
    };
    const parse = (...entries: Record<string, unknown>[]) =>
      parsePublishedReleaseIndex({ format: 1, releases: entries }, opts);
    return { l1, l2, dm32, parse };
  }

  it('reads a two-row Mini release, one row per layout, sharing radio and version', async () => {
    const { l1, l2, parse } = await mini();
    const rows = parse(entryOf(l1.row), entryOf(l2.row));
    expect(rows.map((r) => [r.radioId, r.tag, r.layout])).toEqual([
      ['baofeng-uv5rmini', '9.9.9', 'L1'],
      ['baofeng-uv5rmini', '9.9.9', 'L2'],
    ]);
  });

  it('reads a Mini release with one row only', async () => {
    const { l2, parse } = await mini();
    expect(parse(entryOf(l2.row)).map((r) => r.layout)).toEqual(['L2']);
  });

  it('reads a Mini row without a layout, to be resolved from its build name when loaded', async () => {
    const { parse } = await mini();
    const bare = await syntheticUv5rMiniRelease({ layout: 'L2', rowLayout: null });
    const [row] = parse(entryOf(bare.row));
    expect(row!.layout).toBeUndefined();
    expect('layout' in row!).toBe(false);
  });

  it('refuses a V4 row and any other layout outside the release layouts', async () => {
    const { l1, parse } = await mini();
    expect(messageOf(() => parse({ ...entryOf(l1.row), layout: 'V4' }))).toMatch(
      /baofeng-uv5rmini 9\.9\.9: V4 is not a release layout/,
    );
    expect(messageOf(() => parse({ ...entryOf(l1.row), layout: 'L3' }))).toMatch(
      /L3 is not a release layout/,
    );
    expect(messageOf(() => parse({ ...entryOf(l1.row), layout: 7 }))).toMatch(/bad layout/);
  });

  it('refuses two rows for one layout of one version', async () => {
    const { l1, parse } = await mini();
    expect(messageOf(() => parse(entryOf(l1.row), entryOf(l1.row)))).toMatch(
      /baofeng-uv5rmini 9\.9\.9 L1 on stock v0\.0\.1-test is listed twice/,
    );
  });

  it("reads a row's optional base, which must be a known base and its own stock's", async () => {
    const { l1, parse } = await mini();
    const [row] = parse({ ...entryOf(l1.row), base: 'synthetic' });
    expect(row!.base).toBe('synthetic');
    expect('base' in parse(entryOf(l1.row))[0]!).toBe(false);
    expect(messageOf(() => parse({ ...entryOf(l1.row), base: 'nrf-v0.04' }))).toMatch(
      /nrf-v0\.04 is not a stock base Studio knows/,
    );
    expect(messageOf(() => parse({ ...entryOf(l1.row), base: 7 }))).toMatch(/bad base/);
  });

  it("refuses a row whose base is a known base of another stock version than the row's", async () => {
    const { l1 } = await mini();
    // Two stocks: base A (`synthetic`) on the row's stock version, base B on another one.
    const twoStocks = {
      ...l1.descriptor,
      alsoAccepts: [
        { version: 'v0.0.2-test', baseName: 'synthetic-b', members: l1.descriptor.members },
      ],
    };
    const parse = (...entries: Record<string, unknown>[]) =>
      parsePublishedReleaseIndex(
        { format: 1, releases: entries },
        { descriptors: [twoStocks], loadPatchBytes: async () => new Uint8Array(0) },
      );
    expect(parse({ ...entryOf(l1.row), base: 'synthetic' })[0]!.base).toBe('synthetic');
    expect(
      parse({ ...entryOf(l1.row), stockVersion: 'v0.0.2-test', base: 'synthetic-b' })[0]!.base,
    ).toBe('synthetic-b');
    expect(messageOf(() => parse({ ...entryOf(l1.row), base: 'synthetic-b' }))).toMatch(
      /base synthetic-b is not stock v0\.0\.1-test/,
    );
  });

  it('refuses a base on a radio without layouts', async () => {
    const { dm32, parse } = await mini();
    expect(messageOf(() => parse({ ...entryOf(dm32.row), base: 'x' }))).toMatch(
      /this radio's releases have no bases/,
    );
  });

  it('leaves other radios unchanged: no layout, and a layout on their row is refused', async () => {
    const { dm32, l1, parse } = await mini();
    const [row] = parse(entryOf(dm32.row), entryOf(l1.row));
    expect('layout' in row!).toBe(false);
    expect(messageOf(() => parse({ ...entryOf(dm32.row), layout: 'L1' }))).toMatch(
      /this radio's releases have no layouts/,
    );
  });
});
