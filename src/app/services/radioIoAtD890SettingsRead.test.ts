import { describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  atD890SettingsReadFromSnapshot,
  atD890SettingsTargetForEgress,
} from './radioIoAtD890SettingsRead.ts';

describe('atD890SettingsReadFromSnapshot', () => {
  it('decodes a snapshot into the page read without setting anything', () => {
    const localInfo = new Uint8Array(0x100);
    localInfo[0x04] = 1;
    new TextEncoder().encodeInto('SN00000099', localInfo.subarray(0x30));
    const read = atD890SettingsReadFromSnapshot(
      {
        localInfo,
        main: new Uint8Array(0x200),
        ext: new Uint8Array(0x60),
        masterId: new Uint8Array(0x40),
        bandCode: 3,
      },
      'stock',
      1234,
    );
    expect(read.bandCode).toBe(3);
    expect(read.readAt).toBe(1234);
    expect(read.languageLock).toBe(1);
    expect(read.serial).toContain('0099');
    expect(read.decoded.keyTone).toBeDefined();
  });

  it('picks the target from the egress profile', () => {
    expect(
      atD890SettingsTargetForEgress(newRadioBuildForProfile('p', 'radio-io-at-d890uv').egress),
    ).toBe('stock');
    expect(
      atD890SettingsTargetForEgress(
        newRadioBuildForProfile('p', 'radio-io-at-d890uv-mm9pdy').egress,
      ),
    ).toBe('mm9pdy');
  });
});
