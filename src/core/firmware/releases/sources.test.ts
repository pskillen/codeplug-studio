import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../errors.ts';
import { syntheticDm32Release } from './__fixtures__/syntheticReleases.ts';
import { createBundledFirmwareReleaseSource } from './bundledSource.ts';
import { listKnownPatchedResults } from './index.ts';
import type { BundledFirmwareRelease } from './types.ts';
import { createUserPatchSource } from './userPatchSource.ts';

async function codeOf(p: Promise<unknown>): Promise<string> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(FirmwareError);
  return (err as FirmwareError).code;
}

describe('bundled release source', () => {
  it('loads and parses a row whose bytes match the published hash', async () => {
    const { row } = await syntheticDm32Release();
    const loaded = await createBundledFirmwareReleaseSource([row]).loadPatch(
      'baofeng-dm32uv',
      row.tag,
    );
    expect(loaded.provenance).toBe('bundled');
    expect(loaded.release).toBe(row);
    expect(loaded.parsed.description.version).toBe(row.tag);
  });

  it('refuses a row whose bytes were altered', async () => {
    const { row, patchBytes } = await syntheticDm32Release();
    const altered = patchBytes.slice();
    altered[altered.length - 2] = 0x20;
    const bad: BundledFirmwareRelease = { ...row, loadBytes: async () => altered };
    expect(
      await codeOf(createBundledFirmwareReleaseSource([bad]).loadPatch('baofeng-dm32uv', row.tag)),
    ).toBe('patch-unreadable');
  });

  it('lists finals only unless RCs are asked for, newest first', async () => {
    const { row } = await syntheticDm32Release();
    const rows: BundledFirmwareRelease[] = [
      { ...row, tag: '1.0.0', publishedOn: '2026-01-01' },
      { ...row, tag: '1.1.0-rc.1', channel: 'rc', publishedOn: '2026-03-01' },
      { ...row, tag: '1.0.1', publishedOn: '2026-02-01' },
      { ...row, tag: '1.0.2', publishedOn: '2026-02-01' },
      { ...row, radioId: 'anytone-at-d890uv', tag: '5.0.0' },
    ];
    const source = createBundledFirmwareReleaseSource(rows);
    const finals = await source.listReleases('baofeng-dm32uv', { includeRc: false });
    expect(finals.map((r) => r.key)).toEqual(['1.0.2', '1.0.1', '1.0.0']);
    const all = await source.listReleases('baofeng-dm32uv', { includeRc: true });
    expect(all.map((r) => r.key)).toEqual(['1.1.0-rc.1', '1.0.2', '1.0.1', '1.0.0']);
    expect(all[0]).toMatchObject({ channel: 'rc', provenance: 'bundled' });
  });

  it('lists known patched results per radio', async () => {
    const { row } = await syntheticDm32Release();
    expect(listKnownPatchedResults('baofeng-dm32uv', [row])).toEqual([
      { radioId: 'baofeng-dm32uv', label: `release ${row.tag}`, sha256: row.resultSha256 },
    ]);
    expect(listKnownPatchedResults('anytone-at-d890uv', [row])).toEqual([]);
  });
});

describe('user patch source', () => {
  it('treats a file identical to a bundled release as that release', async () => {
    const { row, patchBytes, descriptor } = await syntheticDm32Release();
    const source = createUserPatchSource(
      { name: 'x.patch.json', bytes: patchBytes },
      { rows: [row], descriptors: [descriptor] },
    );
    const [summary] = await source.listReleases('baofeng-dm32uv', { includeRc: false });
    expect(summary).toMatchObject({ provenance: 'bundled', label: row.tag });
    const loaded = await source.loadPatch('baofeng-dm32uv', summary!.key);
    expect(loaded.provenance).toBe('bundled');
    expect(loaded.release).toBe(row);
  });

  it('marks a different valid patch as unreviewed', async () => {
    const { row, descriptor } = await syntheticDm32Release();
    const other = await syntheticDm32Release({ version: '2.0.0' });
    const source = createUserPatchSource(
      { name: 'y.patch.json', bytes: other.patchBytes },
      { rows: [row], descriptors: [descriptor] },
    );
    const [summary] = await source.listReleases('baofeng-dm32uv', { includeRc: false });
    expect(summary).toMatchObject({
      provenance: 'unreviewed',
      label: '2.0.0',
      channel: 'unknown',
      key: `user:${other.patchSha256}`,
    });
    const loaded = await source.loadPatch('baofeng-dm32uv', summary!.key);
    expect(loaded.provenance).toBe('unreviewed');
    expect(loaded.release).toBeUndefined();
  });

  it("refuses the other radio's patch name", async () => {
    const { patchBytes } = await syntheticDm32Release();
    const source = createUserPatchSource({ name: 'z.patch.json', bytes: patchBytes }, { rows: [] });
    const err = await source
      .listReleases('anytone-at-d890uv', { includeRc: false })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirmwareError);
    expect((err as FirmwareError).code).toBe('patch-wrong-radio');
    expect((err as FirmwareError).message).toBe('This patch is for the Baofeng DM-32UV.');
  });

  it('passes a parse refusal through', async () => {
    const source = createUserPatchSource({ name: 'bad.json', bytes: Uint8Array.of(0xff, 0xfe) });
    expect(await codeOf(source.listReleases('baofeng-dm32uv', { includeRc: false }))).toBe(
      'patch-unreadable',
    );
  });
});
