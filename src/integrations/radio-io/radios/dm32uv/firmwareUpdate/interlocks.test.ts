import { describe, expect, it } from 'vitest';

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

  it('refuses the wrong length', () => {
    const bin = syntheticDm32Image(860_416 + 1024);
    expect(() => checkDm32FirmwareImage(preparedDm32Image(bin))).toThrow(RadioInterlockError);
    expect(() => checkDm32FirmwareImage(preparedDm32Image(syntheticDm32Image(860_415)))).toThrow(
      RadioInterlockError,
    );
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
