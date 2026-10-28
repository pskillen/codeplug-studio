/**
 * A `retevis-rt95-firmware` patch applied to the golden synthetic package gives an image the updater's interlocks
 * accept and the mock bootloader receives byte-exact. Lives here (integrations may import core; core may not import
 * integrations).
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { applyFirmwarePatch, parseFirmwarePatch } from '@core/firmware/patch/index.ts';
import {
  makeSyntheticRt95Patch,
  synthRt95Built,
} from '@core/firmware/patch/formats/retevis-rt95-firmware/__fixtures__/makeSyntheticPatch.ts';

import { Rt95BootloaderMock } from './__fixtures__/rt95BootloaderMock.ts';
import {
  preparedRt95HeadImage,
  RT95_GOLDEN_SHA256,
  synthRt95HeadPackage,
} from './__fixtures__/syntheticPackage.ts';
import { checkRt95HeadFirmwareImage } from './interlocks.ts';
import { createRt95HeadFirmwareUpdater } from './updater.ts';

const golden = synthRt95HeadPackage();
const stockPkg = {
  radioId: 'retevis-rt95-head' as const,
  files: { cdd: golden.cdd, cdi: golden.cdi, spi: golden.spi },
};
const encode = (json: unknown) => new TextEncoder().encode(JSON.stringify(json));

describe('patch result against the updater interlocks', () => {
  it('a hook plus an appended tail yields an image the interlocks accept', async () => {
    const cdd = new Uint8Array(golden.cdd.length + 1500);
    cdd.set(golden.cdd);
    cdd.fill(0xa5, golden.cdd.length);
    cdd[0x100] ^= 0xff;
    const built = synthRt95Built(golden, cdd);
    const json = await makeSyntheticRt95Patch(golden, built, '1.0.0');
    const out = await applyFirmwarePatch(stockPkg, parseFirmwarePatch(encode(json)));
    const pkg = checkRt95HeadFirmwareImage(preparedRt95HeadImage(out.files as never));
    expect(pkg.entry.len).toBe(cdd.length);
    expect(pkg.entry.offset).toBe(0);
  });

  it('the no-op patch flashes the golden stream, byte-exact', async () => {
    const json = await makeSyntheticRt95Patch(golden, golden, 'noop');
    expect(json.hooks).toEqual([]);
    const out = await applyFirmwarePatch(stockPkg, parseFirmwarePatch(encode(json)));
    expect(createHash('sha256').update(out.files.cdd!).digest('hex')).toBe(RT95_GOLDEN_SHA256.cdd);
    const mock = new Rt95BootloaderMock();
    const updater = createRt95HeadFirmwareUpdater();
    await updater.identify(mock);
    await updater.flash(preparedRt95HeadImage(out.files as never), {});
    expect(createHash('sha256').update(Uint8Array.from(mock.received)).digest('hex')).toBe(
      RT95_GOLDEN_SHA256.stream,
    );
  });
});
