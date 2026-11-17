/**
 * UV-5R Mini releases keyed by stock base and version (D133): each stock base is a variant with its own SemVer line,
 * and Studio lists, keys, picks and loads by (base, version), never by version alone.
 */
import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../errors.ts';
import {
  syntheticDm32Release,
  syntheticUv5rMiniVariantRelease,
  type SynthMiniBase,
} from './__fixtures__/syntheticReleases.ts';
import { uv5rMiniVariantOfBase } from '../../radios/baofeng/uv-5r-mini/radioInfo.ts';
import { buildNameLayout, layoutFiles, partnerFor, patchForLayout } from './layouts.ts';
import {
  compareReleaseTags,
  createPublishedFirmwareReleaseSource,
  publishedReleaseKey,
  publishedToStockChoices,
  releasesForBase,
} from './publishedSource.ts';
import type { PublishedFirmwareRelease } from './types.ts';
import { createUserPatchSource, ONE_VARIANT_FILE } from './userPatchSource.ts';

const MINI = 'baofeng-uv5rmini';

const rowsOf =
  (...rows: PublishedFirmwareRelease[]) =>
  async (): Promise<readonly PublishedFirmwareRelease[]> =>
    rows;

async function refusal(p: Promise<unknown>): Promise<FirmwareError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(FirmwareError);
  return err as FirmwareError;
}

const release = (base: SynthMiniBase, version = '9.9.9', more = {}) =>
  syntheticUv5rMiniVariantRelease({ base, version, ...more });

describe('Mini releases by stock base and version', () => {
  it('keeps the same version on two bases apart in the list, and keeps the other file for a stock retry', async () => {
    const nrf = await release('nrf-v0.27', '1.0.0', { feature: 'zones' });
    const nrfb = await release('nrfb-v0.04', '1.0.0', { feature: 'zones' });
    const source = createPublishedFirmwareReleaseSource(rowsOf(nrf.row, nrfb.row), [
      nrf.descriptor,
    ]);
    const list = await source.listReleases(MINI, { includeRc: false });
    expect(list.map((s) => [s.key, s.label, s.supports])).toEqual([
      ['nrf-v0.27:1.0.0', '1.0.0', ['v0.27 (NRF)']],
      ['nrfb-v0.04:1.0.0', '1.0.0', ['v0.04 (NRFB)']],
    ]);
    const loaded = await source.loadPatch(MINI, 'nrfb-v0.04:1.0.0');
    expect(loaded.sha256).toBe(nrfb.patchSha256);
    expect(loaded.layout).toBe('L1');
    expect(layoutFiles(loaded).map((f) => f.layout)).toEqual(['L1', 'L2']);
    expect(patchForLayout(loaded, 'L2', 'nrf-v0.27')!.sha256).toBe(nrf.patchSha256);
    // A stock radio (no reported base) is offered the other layout. A reported radio stays on its variant.
    expect(partnerFor(loaded, 'L1')!.sha256).toBe(nrf.patchSha256);
    expect(
      partnerFor(loaded, 'L1', {
        refusedBase: 'nrfb-v0.04',
        variantOfBase: uv5rMiniVariantOfBase,
      }),
    ).toBeUndefined();
    // The version alone names no release.
    expect((await refusal(source.loadPatch(MINI, '1.0.0'))).message).toMatch(
      /not published for this radio/,
    );
  });

  it('lists only the radio base when asked, so a lower matching version beats a higher one on another base', async () => {
    const mine = await release('nrfb-v0.04', '1.0.0');
    const newer = await release('nrf-v0.27', '1.1.0');
    const source = createPublishedFirmwareReleaseSource(rowsOf(newer.row, mine.row), [
      mine.descriptor,
    ]);
    const forRadio = await source.listReleases(MINI, { includeRc: false, base: 'nrfb-v0.04' });
    expect(forRadio.map((s) => s.key)).toEqual(['nrfb-v0.04:1.0.0']);
    const all = await source.listReleases(MINI, { includeRc: false });
    expect(all[0]!.key).toBe('nrf-v0.27:1.1.0');
    const picked = releasesForBase(all, 'nrfb-v0.04');
    expect(picked.forBase.map((s) => s.key)).toEqual(['nrfb-v0.04:1.0.0']);
    // That variant is behind the pack: the newer release elsewhere is named.
    expect(picked.newerElsewhere?.key).toBe('nrf-v0.27:1.1.0');
    expect(releasesForBase(all, 'nrf-v0.27').newerElsewhere).toBeUndefined();
    // A base with no release yet is still told about the others, and offered nothing.
    const none = releasesForBase(
      await createPublishedFirmwareReleaseSource(rowsOf(newer.row), [mine.descriptor]).listReleases(
        MINI,
        { includeRc: false },
      ),
      'nrfb-v0.04',
    );
    expect(none.forBase).toEqual([]);
    expect(none.newerElsewhere?.key).toBe('nrf-v0.27:1.1.0');
  });

  it('orders by SemVer within a base: rc.10 above rc.2, a final above its RCs, whatever the dates', async () => {
    const rows = await Promise.all([
      release('nrf-v0.27', '1.0.1-rc.2', { publishedOn: '2026-03-01' }),
      release('nrf-v0.27', '1.0.1-rc.10', { publishedOn: '2026-02-01' }),
      release('nrf-v0.27', '1.0.1', { publishedOn: '2026-01-01' }),
      release('nrf-v0.27', '1.0.0', { publishedOn: '2026-04-01' }),
    ]);
    const source = createPublishedFirmwareReleaseSource(rowsOf(...rows.map((r) => r.row)), [
      rows[0]!.descriptor,
    ]);
    expect((await source.listReleases(MINI, { includeRc: true })).map((s) => s.label)).toEqual([
      '1.0.1',
      '1.0.1-rc.10',
      '1.0.1-rc.2',
      '1.0.0',
    ]);
    expect(compareReleaseTags('1.0.0-rc.2', '1.0.0-rc.10')).toBeGreaterThan(0);
    expect(compareReleaseTags('1.0.0', '1.0.0-rc.9')).toBeLessThan(0);
  });

  it('still reads the shipped legacy row: mm9pdy-L2-1.0.0 on nrf-v0.27 is v0.27-NRF 1.0.0', async () => {
    const legacy = await release('nrf-v0.27', '1.0.0', { buildName: 'mm9pdy-L2-1.0.0' });
    const source = createPublishedFirmwareReleaseSource(rowsOf(legacy.row), [legacy.descriptor]);
    const [summary] = await source.listReleases(MINI, { includeRc: false, base: 'nrf-v0.27' });
    expect(summary!.key).toBe('nrf-v0.27:1.0.0');
    const loaded = await source.loadPatch(MINI, summary!.key);
    expect(loaded.layout).toBe('L2');
    expect(loaded.provenance).toBe('published');
    // A legacy name whose layout tag is not its base's layout is refused.
    const crossed = await release('nrf-v0.27', '1.0.0', { buildName: 'mm9pdy-L1-1.0.0' });
    expect(
      (
        await refusal(
          createPublishedFirmwareReleaseSource(rowsOf(crossed.row), [crossed.descriptor]).loadPatch(
            MINI,
            'nrf-v0.27:1.0.0',
          ),
        )
      ).message,
    ).toMatch(/different radio firmware/);
  });

  it('keeps the to-stock patch per base: each base its own, finals first', async () => {
    const toStock = (sha: string) => ({ sha256: sha, loadBytes: async () => new Uint8Array() });
    const nrf = await release('nrf-v0.27', '1.0.0');
    const nrfRc = await release('nrf-v0.27', '1.0.1-rc.1');
    const nrfb = await release('nrfb-v0.04', '1.0.0');
    const rows = [
      { ...nrfRc.row, toStock: toStock('a'.repeat(64)) },
      { ...nrf.row, toStock: toStock('b'.repeat(64)) },
      { ...nrfb.row, toStock: toStock('c'.repeat(64)) },
    ];
    expect(publishedToStockChoices(rows, MINI).map((r) => [r.base, r.toStock!.sha256])).toEqual([
      ['nrf-v0.27', 'b'.repeat(64)],
      ['nrfb-v0.04', 'c'.repeat(64)],
    ]);
  });
});

describe('Mini release files fail closed on metadata that does not name one base', () => {
  const load = async (r: Awaited<ReturnType<typeof release>>) =>
    refusal(
      createPublishedFirmwareReleaseSource(rowsOf(r.row), [r.descriptor]).loadPatch(
        MINI,
        publishedReleaseKey(r.row),
      ),
    );

  it("refuses a row whose layout disagrees with its base's", async () => {
    const err = await load(await release('nrf-v0.27', '9.9.9', { rowLayout: 'L1' }));
    expect(err.code).toBe('patch-wrong-layout');
  });

  it('refuses a variant name for another base than the patch and row', async () => {
    const err = await load(await release('nrf-v0.27', '9.9.9', { buildName: 'v0.04-NRFB-9.9.9' }));
    expect(err.code).toBe('patch-wrong-layout');
  });

  it('refuses a patch built on the other base’s stock, whatever its name and base say', async () => {
    const err = await load(await release('nrf-v0.27', '9.9.9', { stockOf: 'nrfb-v0.04' }));
    expect(err.message).toMatch(/not built on stock v0\.27 \(NRF\)/);
  });

  it('refuses a patch whose base is missing or another than the row', async () => {
    const err = await load(await release('nrf-v0.27', '9.9.9', { patchBase: 'nrfb-v0.04' }));
    expect(err.message).toMatch(
      /the release list says nrf-v0\.27, but its patch is on nrfb-v0\.04/,
    );
  });

  it('refuses a variant name with an unknown prefix, an RC above 9, or another version', async () => {
    for (const buildName of ['v0.05-NRFX-9.9.9', 'v0.27-NRF-9.9.9-rc.10', 'v0.27-NRF-9.9.8']) {
      const version = buildName.endsWith('rc.10') ? '9.9.9-rc.10' : '9.9.9';
      const err = await load(await release('nrf-v0.27', version, { buildName }));
      expect(err.code, buildName).toBe('patch-wrong-layout');
    }
  });
});

describe('Mini patch files from disk', () => {
  const file = (name: string, bytes: Uint8Array) => ({ name, bytes });

  it('takes a variant file: its layout from its base once its pinned stock checks out', async () => {
    const nrfb = await release('nrfb-v0.04', '1.0.0');
    const source = createUserPatchSource(file('a.json', nrfb.patchBytes), {
      rows: [],
      descriptors: [nrfb.descriptor],
    });
    const [summary] = await source.listReleases(MINI, { includeRc: true });
    const loaded = await source.loadPatch(MINI, summary!.key);
    expect(loaded.provenance).toBe('unreviewed');
    expect(loaded.layout).toBe('L1');
  });

  it('matches a published variant file to its own row, not the same version on another base', async () => {
    const nrf = await release('nrf-v0.27', '1.0.0');
    const nrfb = await release('nrfb-v0.04', '1.0.0');
    const source = createUserPatchSource(file('a.json', nrfb.patchBytes), {
      rows: [nrf.row, nrfb.row],
      descriptors: [nrf.descriptor],
    });
    const [summary] = await source.listReleases(MINI, { includeRc: true });
    const loaded = await source.loadPatch(MINI, summary!.key);
    expect(loaded.release).toBe(nrfb.row);
  });

  it('refuses a variant file built on the wrong stock, and a PR-style name on an unknown base', async () => {
    const crossed = await release('nrf-v0.27', '1.0.0', { stockOf: 'nrfb-v0.04' });
    const err = await refusal(
      createUserPatchSource(file('a.json', crossed.patchBytes), {
        rows: [],
        descriptors: [crossed.descriptor],
      }).listReleases(MINI, { includeRc: true }),
    );
    expect(err.message).toMatch(/doesn't match the .* firmware it is built on/);
    const unknown = await release('nrf-v0.27', '1.0.0', { buildName: 'v0.99-NRF-pr12-gabc12' });
    expect(
      (
        await refusal(
          createUserPatchSource(file('a.json', unknown.patchBytes), {
            rows: [],
            descriptors: [unknown.descriptor],
          }).listReleases(MINI, { includeRc: true }),
        )
      ).message,
    ).toMatch(/is not a release file for any/);
  });

  it('takes a PR-style variant name whose base and stock check out', async () => {
    const pr = await release('nrf-v0.27', '1.0.0', { buildName: 'v0.27-NRF-pr12-gabc12' });
    const loaded = await createUserPatchSource(file('a.json', pr.patchBytes), {
      rows: [],
      descriptors: [pr.descriptor],
    }).loadPatch(MINI, `user:${pr.patchSha256}`);
    expect(loaded.layout).toBe('L2');
  });

  it('never pairs two variant files, even of one version', async () => {
    const nrf = await release('nrf-v0.27', '1.0.0');
    const nrfb = await release('nrfb-v0.04', '1.0.0');
    const err = await refusal(
      createUserPatchSource([file('a.json', nrf.patchBytes), file('b.json', nrfb.patchBytes)], {
        rows: [],
        descriptors: [nrf.descriptor],
      }).listReleases(MINI, { includeRc: true }),
    );
    expect(err.message).toBe(ONE_VARIANT_FILE);
  });

  it('cross-checks a variant name against the patch description directly', async () => {
    const nrf = await release('nrf-v0.27', '1.0.0');
    const description = {
      buildName: 'v0.27-NRF-1.0.0',
      base: 'nrf-v0.27',
      version: '1.0.0',
      stock: { ufw: nrf.descriptor.members[0]! },
    };
    expect(buildNameLayout(nrf.descriptor, description)).toBe('L2');
    expect(() => buildNameLayout(nrf.descriptor, { ...description, base: undefined })).toThrow(
      FirmwareError,
    );
  });
});

describe('other radios keep their releases keyed by version', () => {
  it('a DM-32 release has no base and keeps its tag as its key and its date order', async () => {
    const a = await syntheticDm32Release({ version: '1.0.0' });
    const b = await syntheticDm32Release({ version: '1.0.1' });
    const older = { ...b.row, publishedOn: '2025-01-01' };
    const source = createPublishedFirmwareReleaseSource(rowsOf(older, a.row), [a.descriptor]);
    const list = await source.listReleases('baofeng-dm32uv', { includeRc: false });
    expect(list.map((s) => s.key)).toEqual(['1.0.0', '1.0.1']);
    expect(releasesForBase(list, 'nrf-v0.27').forBase).toBe(list);
  });
});
