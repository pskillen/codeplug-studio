import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../errors.ts';
import {
  syntheticDm32Release,
  syntheticUv5rMiniRelease,
} from './__fixtures__/syntheticReleases.ts';
import { UV5RMINI_STOCK_FIRMWARE } from '../../radios/baofeng/uv-5r-mini/firmware.ts';
import { uv5rMiniVariantOfBase } from '../../radios/baofeng/uv-5r-mini/radioInfo.ts';
import {
  fileBase,
  layoutFiles,
  loadedBases,
  loadedLayouts,
  partnerFor,
  patchForLayout,
} from './layouts.ts';
import { createPublishedFirmwareReleaseSource } from './publishedSource.ts';
import type { LoadedFirmwarePatch, PublishedFirmwareRelease } from './types.ts';
import { createUserPatchSource, NOT_ONE_RELEASE } from './userPatchSource.ts';

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

describe('published release with one row per flash layout', () => {
  it('lists the release once and loads both files, picked by layout', async () => {
    const l1 = await syntheticUv5rMiniRelease({ layout: 'L1' });
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2' });
    // Index order L2 first: the loaded release is still in layout order.
    const source = createPublishedFirmwareReleaseSource(rowsOf(l2.row, l1.row), [l1.descriptor]);
    const list = await source.listReleases(MINI, { includeRc: false });
    expect(list.map((s) => s.key)).toEqual(['9.9.9']);

    const loaded = await source.loadPatch(MINI, '9.9.9');
    expect(loaded.layout).toBe('L1');
    expect(loadedLayouts(loaded)).toEqual(['L1', 'L2']);
    expect(loaded.otherLayouts?.[0]?.release).toBe(l2.row);

    const forL2 = patchForLayout(loaded, 'L2')!;
    expect(forL2.layout).toBe('L2');
    expect(forL2.sha256).toBe(l2.patchSha256);
    expect(forL2.otherLayouts?.map((f) => f.layout)).toEqual(['L1']);
    expect(patchForLayout(loaded, 'L1')!.sha256).toBe(l1.patchSha256);
    expect(partnerFor(loaded, 'L2')!.sha256).toBe(l1.patchSha256);
    expect(partnerFor(loaded, 'L1')!.sha256).toBe(l2.patchSha256);
  });

  it("says which stock versions a release's rows are on, in the radio's stock order", async () => {
    const { row } = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const v027 = { ...row, stockVersion: 'v0.27 (NRF)' };
    const v004 = { ...row, layout: 'L1', stockVersion: 'v0.04 (NRFB)' };
    const only = createPublishedFirmwareReleaseSource(rowsOf(v027), [UV5RMINI_STOCK_FIRMWARE]);
    expect((await only.listReleases(MINI, { includeRc: false }))[0]!.supports).toEqual([
      'v0.27 (NRF)',
    ]);
    const both = createPublishedFirmwareReleaseSource(rowsOf(v004, v027), [
      UV5RMINI_STOCK_FIRMWARE,
    ]);
    const list = await both.listReleases(MINI, { includeRc: false });
    expect(list).toHaveLength(1);
    expect(list[0]!.supports).toEqual(['v0.27 (NRF)', 'v0.04 (NRFB)']);
    // Another version's rows are not counted.
    const other = createPublishedFirmwareReleaseSource(
      rowsOf(v027, { ...v004, tag: '9.9.8', publishedOn: '2025-01-01' }),
      [UV5RMINI_STOCK_FIRMWARE],
    );
    expect((await other.listReleases(MINI, { includeRc: false })).map((s) => s.supports)).toEqual([
      ['v0.27 (NRF)'],
      ['v0.04 (NRFB)'],
    ]);
  });

  it('gives no stock versions for a radio with one', async () => {
    const { row } = await syntheticDm32Release();
    const source = createPublishedFirmwareReleaseSource(rowsOf(row));
    const [summary] = await source.listReleases('baofeng-dm32uv', { includeRc: false });
    expect(summary).not.toHaveProperty('supports');
  });

  it('has no partner for a release with one row only', async () => {
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const loaded = await createPublishedFirmwareReleaseSource(rowsOf(l2.row), [
      l2.descriptor,
    ]).loadPatch(MINI, '9.9.9');
    expect(loaded.layout).toBe('L2');
    expect(loaded.otherLayouts).toBeUndefined();
    expect(partnerFor(loaded, 'L2')).toBeUndefined();
    expect(patchForLayout(loaded, 'L1')).toBeUndefined();
  });

  it("takes a row's missing layout from its build name", async () => {
    const l1 = await syntheticUv5rMiniRelease({ layout: 'L1', rowLayout: null });
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2', rowLayout: null });
    const loaded = await createPublishedFirmwareReleaseSource(rowsOf(l1.row, l2.row), [
      l1.descriptor,
    ]).loadPatch(MINI, '9.9.9');
    expect(loadedLayouts(loaded)).toEqual(['L1', 'L2']);
  });

  it('picks by the radio stock base too, and never offers the nearest build', async () => {
    const l1 = await syntheticUv5rMiniRelease({ layout: 'L1' });
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const loaded = await createPublishedFirmwareReleaseSource(rowsOf(l1.row, l2.row), [
      l1.descriptor,
    ]).loadPatch(MINI, '9.9.9');
    expect(patchForLayout(loaded, 'L2', 'synthetic')!.sha256).toBe(l2.patchSha256);
    expect(patchForLayout(loaded, 'L2', 'nrf-v0.27')).toBeUndefined();
    expect(loadedBases(loaded)).toEqual(['synthetic', 'synthetic']);
  });

  it("refuses a row whose base disagrees with its patch's base", async () => {
    const crossed = await syntheticUv5rMiniRelease({ layout: 'L2', patchBase: 'other' });
    const err = await refusal(
      createPublishedFirmwareReleaseSource(rowsOf({ ...crossed.row, base: 'synthetic' }), [
        crossed.descriptor,
      ]).loadPatch(MINI, '9.9.9'),
    );
    expect(err.message).toMatch(/the release list says synthetic, but its patch is on other/);
    // Without a row base, a patch on another base than its stock's is refused too.
    const bare = await refusal(
      createPublishedFirmwareReleaseSource(rowsOf(crossed.row), [crossed.descriptor]).loadPatch(
        MINI,
        '9.9.9',
      ),
    );
    expect(bare.message).toMatch(/its patch names other, but it is built on synthetic/);
  });

  it('offers a retry partner only of the same variant (NRF or NRFB)', () => {
    const file = (layout: string, base: string) =>
      ({ layout, parsed: { description: { base } } }) as unknown as LoadedFirmwarePatch;
    const variantOfBase = uv5rMiniVariantOfBase;
    // Today's bases: L1 is NRFB v0.04 and L2 is NRF v0.27, so the partner always crosses the suffix: none.
    const today: LoadedFirmwarePatch = {
      ...file('L1', 'nrfb-v0.04'),
      otherLayouts: [file('L2', 'nrf-v0.27')],
    };
    expect(partnerFor(today, 'L2', { refusedBase: 'nrf-v0.27', variantOfBase })).toBeUndefined();
    expect(partnerFor(today, 'L1', { refusedBase: 'nrfb-v0.04', variantOfBase })).toBeUndefined();
    // A same-suffix pair (a future NRF v0.04 base) is a partner, both ways.
    const nrf: LoadedFirmwarePatch = {
      ...file('L1', 'nrf-v0.04'),
      otherLayouts: [file('L2', 'nrf-v0.27'), file('L2', 'nrfb-v0.27')],
    };
    expect(fileBase(partnerFor(nrf, 'L2', { refusedBase: 'nrf-v0.27', variantOfBase })!)).toBe(
      'nrf-v0.04',
    );
    expect(fileBase(partnerFor(nrf, 'L1', { refusedBase: 'nrf-v0.04', variantOfBase })!)).toBe(
      'nrf-v0.27',
    );
    // An unknown refused base gives no partner.
    expect(partnerFor(nrf, 'L2', { variantOfBase })).toBeUndefined();
  });

  it('refuses a row whose layout disagrees with its build name', async () => {
    const crossed = await syntheticUv5rMiniRelease({ layout: 'L2', rowLayout: 'L1' });
    const err = await refusal(
      createPublishedFirmwareReleaseSource(rowsOf(crossed.row), [crossed.descriptor]).loadPatch(
        MINI,
        '9.9.9',
      ),
    );
    expect(err.code).toBe('patch-wrong-layout');
    expect(err.message).toMatch(/the release list and its build are for different radio firmware/);
    expect(err.message).not.toMatch(/\bL[12]\b/);
  });

  it('refuses a row with no layout whose build name names none, and a V4 build', async () => {
    const untagged = await syntheticUv5rMiniRelease({
      rowLayout: null,
      buildName: 'mm9pdy-9.9.9',
    });
    expect(
      (
        await refusal(
          createPublishedFirmwareReleaseSource(rowsOf(untagged.row), [
            untagged.descriptor,
          ]).loadPatch(MINI, '9.9.9'),
        )
      ).message,
    ).toMatch(/can't tell which radio firmware/);
    const v4 = await syntheticUv5rMiniRelease({ layout: 'V4', rowLayout: null });
    expect(
      (
        await refusal(
          createPublishedFirmwareReleaseSource(rowsOf(v4.row), [v4.descriptor]).loadPatch(
            MINI,
            '9.9.9',
          ),
        )
      ).code,
    ).toBe('patch-wrong-layout');
  });

  it('refuses two rows that resolve to one layout', async () => {
    const a = await syntheticUv5rMiniRelease({ layout: 'L2', rowLayout: null });
    const b = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const err = await refusal(
      createPublishedFirmwareReleaseSource(rowsOf(a.row, b.row), [a.descriptor]).loadPatch(
        MINI,
        '9.9.9',
      ),
    );
    expect(err.message).toMatch(/Release 9\.9\.9 has two files for the same radio firmware/);
  });

  it('leaves a radio without layouts as one file with no layout', async () => {
    const { row, descriptor } = await syntheticDm32Release();
    const loaded = await createPublishedFirmwareReleaseSource(rowsOf(row), [descriptor]).loadPatch(
      'baofeng-dm32uv',
      row.tag,
    );
    expect(loaded.layout).toBeUndefined();
    expect(layoutFiles(loaded)).toHaveLength(1);
    expect(patchForLayout(loaded, 'L1')).toBe(loaded);
  });
});

describe('user patch files, one per flash layout', () => {
  const file = (name: string, bytes: Uint8Array) => ({ name, bytes });

  it('takes two files as one release, layouts from their build names', async () => {
    const l1 = await syntheticUv5rMiniRelease({ layout: 'L1' });
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const source = createUserPatchSource(
      [file('b.json', l2.patchBytes), file('a.json', l1.patchBytes)],
      { rows: [], descriptors: [l1.descriptor] },
    );
    const [summary] = await source.listReleases(MINI, { includeRc: true });
    expect(summary).toMatchObject({ provenance: 'unreviewed', label: '9.9.9' });
    const loaded = await source.loadPatch(MINI, summary!.key);
    expect(loaded.provenance).toBe('unreviewed');
    expect(loadedLayouts(loaded)).toEqual(['L1', 'L2']);
    expect(patchForLayout(loaded, 'L2')!.sha256).toBe(l2.patchSha256);
  });

  it('matches two published files to their release rows', async () => {
    const l1 = await syntheticUv5rMiniRelease({ layout: 'L1' });
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const source = createUserPatchSource(
      [file('a.json', l1.patchBytes), file('b.json', l2.patchBytes)],
      { rows: [l1.row, l2.row], descriptors: [l1.descriptor] },
    );
    const [summary] = await source.listReleases(MINI, { includeRc: true });
    const loaded = await source.loadPatch(MINI, summary!.key);
    expect(loaded.release).toBe(l1.row);
    expect(loaded.otherLayouts?.[0]?.release).toBe(l2.row);
  });

  it("runs the matched row's layout and base checks on a file from disk, as on a download", async () => {
    const pick = (r: Awaited<ReturnType<typeof syntheticUv5rMiniRelease>>, row = r.row) =>
      refusal(
        createUserPatchSource(file('a.json', r.patchBytes), {
          rows: [row],
          descriptors: [r.descriptor],
        }).listReleases(MINI, { includeRc: true }),
      );
    const crossedLayout = await syntheticUv5rMiniRelease({ layout: 'L2', rowLayout: 'L1' });
    const layoutErr = await pick(crossedLayout);
    expect(layoutErr.code).toBe('patch-wrong-layout');
    expect(layoutErr.message).toMatch(
      /the release list and its build are for different radio firmware/,
    );
    expect(layoutErr.message).not.toMatch(/\bL[12]\b/);
    const crossedBase = await syntheticUv5rMiniRelease({ layout: 'L2', patchBase: 'other' });
    const baseErr = await pick(crossedBase, { ...crossedBase.row, base: 'synthetic' });
    expect(baseErr.message).toMatch(/the release list says synthetic, but its patch is on other/);
  });

  it('takes one file, with no partner', async () => {
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2' });
    const source = createUserPatchSource(file('b.json', l2.patchBytes), {
      rows: [],
      descriptors: [l2.descriptor],
    });
    const [summary] = await source.listReleases(MINI, { includeRc: true });
    const loaded = await source.loadPatch(MINI, summary!.key);
    expect(loaded.layout).toBe('L2');
    expect(partnerFor(loaded, 'L2')).toBeUndefined();
  });

  it('refuses two files of the same layout', async () => {
    const a = await syntheticUv5rMiniRelease({ layout: 'L1' });
    const b = await syntheticUv5rMiniRelease({ layout: 'L1', buildName: 'mm9pdy-L1-9.9.9-b' });
    const err = await refusal(
      createUserPatchSource([file('a.json', a.patchBytes), file('b.json', b.patchBytes)], {
        rows: [],
        descriptors: [a.descriptor],
      }).listReleases(MINI, { includeRc: true }),
    );
    expect(err.code).toBe('patch-wrong-layout');
    expect(err.message).toMatch(/two files for the same radio firmware/);
  });

  it('refuses a V4 file', async () => {
    const v4 = await syntheticUv5rMiniRelease({ layout: 'V4' });
    const err = await refusal(
      createUserPatchSource(file('v4.json', v4.patchBytes), {
        rows: [],
        descriptors: [v4.descriptor],
      }).listReleases(MINI, { includeRc: true }),
    );
    expect(err.code).toBe('patch-wrong-layout');
    expect(err.message).toMatch(
      /mm9pdy-V4-9\.9\.9 is not a release file for any .* firmware Studio supports/,
    );
  });

  it('refuses two files of different releases', async () => {
    const l1 = await syntheticUv5rMiniRelease({ layout: 'L1' });
    const l2 = await syntheticUv5rMiniRelease({ layout: 'L2', version: '9.9.8' });
    const err = await refusal(
      createUserPatchSource([file('a.json', l1.patchBytes), file('b.json', l2.patchBytes)], {
        rows: [],
        descriptors: [l1.descriptor],
      }).listReleases(MINI, { includeRc: true }),
    );
    expect(err.message).toBe(NOT_ONE_RELEASE);
  });

  it('refuses two files for a radio whose release is one file', async () => {
    const { patchBytes, descriptor } = await syntheticDm32Release();
    const err = await refusal(
      createUserPatchSource([file('a.json', patchBytes), file('b.json', patchBytes)], {
        rows: [],
        descriptors: [descriptor],
      }).listReleases('baofeng-dm32uv', { includeRc: true }),
    );
    expect(err.message).toMatch(/Pick one patch file/);
  });
});
