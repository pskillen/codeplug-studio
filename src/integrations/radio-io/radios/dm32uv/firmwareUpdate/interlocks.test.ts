import { describe, expect, it } from 'vitest';

import {
  DM32UV_FIRMWARE_IMAGE_SIZE,
  DM32UV_FIRMWARE_MAX_IMAGE_SIZE,
} from '@core/radios/baofeng/dm-32uv/firmware.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { preparedDm32Image, syntheticDm32Image } from './__fixtures__/syntheticImage.ts';
import { checkDm32FirmwareImage } from './interlocks.ts';

describe('checkDm32FirmwareImage', () => {
  it('returns the bin bytes for a valid image', () => {
    const bin = syntheticDm32Image();
    expect(checkDm32FirmwareImage(preparedDm32Image(bin))).toBe(bin);
  });

  it('accepts any one of E, N, D in the header marker', () => {
    const bin = syntheticDm32Image();
    bin[0xfd] = 0;
    bin[0xfe] = 0;
    expect(() => checkDm32FirmwareImage(preparedDm32Image(bin))).not.toThrow();
  });

  it('caps the image at the 1 MiB app-area bound', () => {
    expect(DM32UV_FIRMWARE_IMAGE_SIZE).toBe(860_416);
    expect(DM32UV_FIRMWARE_MAX_IMAGE_SIZE).toBe(999_680);
  });

  it.each([
    ['stock length', 860_416],
    ['longer than stock (12 KiB appended)', 860_416 + 12 * 1024],
    ['longer than stock, odd length', 996_868],
    ['exactly the maximum', 999_680],
  ])('accepts an image of %s', (_label, length) => {
    const bin = syntheticDm32Image(length);
    expect(checkDm32FirmwareImage(preparedDm32Image(bin))).toBe(bin);
  });

  it.each([
    ['one byte shorter than stock', 860_415],
    ['one byte over the maximum', 999_681],
  ])('refuses an image %s', (_label, length) => {
    const bin = syntheticDm32Image(length);
    expect(() => checkDm32FirmwareImage(preparedDm32Image(bin))).toThrow(RadioInterlockError);
  });

  it('refuses the wrong model ID', () => {
    const bin = syntheticDm32Image();
    bin[8] = 0x31; // BFUV32-V1
    expect(() => checkDm32FirmwareImage(preparedDm32Image(bin))).toThrow(RadioInterlockError);
  });

  it('refuses a header with none of E, N, D', () => {
    const bin = syntheticDm32Image();
    bin[0xfd] = 0;
    bin[0xfe] = 0;
    bin[0xff] = 0;
    expect(() => checkDm32FirmwareImage(preparedDm32Image(bin))).toThrow(RadioInterlockError);
  });

  it("refuses the other radio's image", () => {
    const bin = syntheticDm32Image();
    expect(() =>
      checkDm32FirmwareImage(preparedDm32Image(bin, { radioId: 'anytone-at-d890uv' })),
    ).toThrow(RadioInterlockError);
  });

  it('refuses an extra role', () => {
    const bin = syntheticDm32Image();
    expect(() =>
      checkDm32FirmwareImage(preparedDm32Image(bin, { files: { bin, extra: new Uint8Array(4) } })),
    ).toThrow(RadioInterlockError);
    expect(() => checkDm32FirmwareImage(preparedDm32Image(bin, { files: { other: bin } }))).toThrow(
      RadioInterlockError,
    );
  });
});
