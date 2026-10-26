/**
 * AT-D890UV LocalInfo / ExpertOptions retain preview.
 */

import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import {
  localInfoRegisterPreview,
  optionalSettingsRetainPreview,
  settingsRetainPreview,
} from './retainPreview.ts';
import { encodeWideCharName } from './wideChar.ts';

describe('settingsRetainPreview', () => {
  it('decodes ExpertOptions fields from LocalInfo', () => {
    const data = new Uint8Array(D890_MAP.LocalInfoLength);
    data[0x02] = 0x01;
    data[0x03] = 2;
    data[0x04] = 0;
    data[0x05] = 0;
    data[0x06] = 0x01;
    data.set(new TextEncoder().encode('1234'), 0x0b);
    data.set(new TextEncoder().encode('D890UV'), 0x10);
    data.set(new TextEncoder().encode('ABCD'), 0x28);
    data.set(new TextEncoder().encode('SN1234567890'), 0x30);

    const rows = settingsRetainPreview(data);
    expect(rows.find((r) => r.label.startsWith('Full test mode'))?.value).toBe('On');
    expect(rows.find((r) => r.label === 'Frequency range')?.value).toBe(
      'Mode 000002 (code 2) · TX 430–440, 144–146 MHz',
    );
    expect(rows.find((r) => r.label.startsWith('Chinese UI'))?.value).toMatch(/Chinese/);
    expect(rows.find((r) => r.label === 'Band-settings password')?.value).toBe('1234');
    expect(rows.find((r) => r.label === 'Radio type')?.value).toBe('D890UV');
    expect(rows.find((r) => r.label === 'Program password')?.value).toBe('ABCD');
    expect(rows.find((r) => r.label === 'Serial number')?.value).toBe('SN1234567890');
  });
});

describe('settingsRetainPreview frequency range', () => {
  const rangeRow = (code: number) => {
    const data = new Uint8Array(D890_MAP.LocalInfoLength);
    data[0x03] = code;
    return settingsRetainPreview(data).find((r) => r.label === 'Frequency range')?.value;
  };

  it('shows code 14 as treated as 0 unless LocalInfo +0x0B holds 890#', () => {
    const data = new Uint8Array(D890_MAP.LocalInfoLength);
    data[0x03] = 14;
    const value = () =>
      settingsRetainPreview(data).find((r) => r.label === 'Frequency range')?.value;
    expect(value()).toBe(
      'Maintenance (needs 890#) not unlocked, treated as 0 (code 14) · TX 400–480, 136–174 MHz',
    );
    data.set([0x38, 0x39, 0x30, 0x23], 0x0b);
    expect(value()).toBe('Maintenance (needs 890#) (code 14) · TX 400–520, 136–174, 220–225 MHz');
  });

  it('describes codes 3, 7 and 19', () => {
    expect(rangeRow(3)).toBe('Amateur Europe (code 3) · TX 430–440, 144–146 MHz');
    expect(rangeRow(7)).toBe('Amateur US (code 7) · TX 420–450, 144–148 MHz');
    expect(rangeRow(19)).toBe(
      'Unknown (treated as 0 by the radio) (code 19) · TX 400–480, 136–174 MHz',
    );
  });
});

describe('optionalSettingsRetainPreview', () => {
  it.each([
    [0, 'English'],
    [1, 'Chinese'],
    [2, 'Russian'],
  ])('labels language %i as %s', (byte, label) => {
    const main = new Uint8Array(D890_MAP.OptionalSettingsMainLength);
    main[0x05] = byte;
    const rows = optionalSettingsRetainPreview(
      main,
      new Uint8Array(D890_MAP.OptionalSettingsExtLength),
    );
    expect(rows.find((r) => r.label === 'CPS language')?.value).toBe(label);
  });

  it('decodes language, password enable, and password chars', () => {
    const main = new Uint8Array(D890_MAP.OptionalSettingsMainLength);
    const ext = new Uint8Array(D890_MAP.OptionalSettingsExtLength);
    main[0x05] = 2; // Russian
    main[0x07] = 1; // password on
    main[0xd6] = 0x01;
    main[0xd7] = 4;
    main[0xd8] = 9;
    main[0xd9] = 0xff;
    main[0xda] = 12;
    main[0xdb] = 77;
    ext.set(encodeWideCharName('LINE ONE', 0x20), 0x00);
    ext.set(encodeWideCharName('LINE TWO', 0x20), 0x20);
    ext.set(new TextEncoder().encode('SECRET12'), 0x40);

    const rows = optionalSettingsRetainPreview(main, ext);
    expect(rows.find((r) => r.label === 'CPS language')?.value).toBe('Russian');
    expect(rows.find((r) => r.label === 'Power-on password enable')?.value).toBe('On');
    expect(rows.find((r) => r.label === 'Chinese UI (Expert options)')?.value).toMatch(
      /Local info/,
    );

    const startup = rows.find((r) => r.label === 'Startup enable');
    expect(startup?.value).toBe('On');
    expect(startup?.address).toBe('0x35000d6');
    expect(rows.find((r) => r.label === 'Startup zone A')?.value).toBe('4');
    expect(rows.find((r) => r.label === 'Startup zone B')?.value).toBe('9');
    expect(rows.find((r) => r.label === 'Startup channel A')?.value).toBe('none');
    expect(rows.find((r) => r.label === 'Startup channel B')?.value).toBe('12');
    expect(rows.find((r) => r.label === 'Default startup channel')).toBeUndefined();
    expect(rows.find((r) => r.offset === '+0xdb')).toBeUndefined();

    const line1 = rows.find((r) => r.label === 'Power-on display line 1');
    expect(line1?.value).toBe('LINE ONE');
    expect(line1?.address).toBe('0x3500900');
    const line2 = rows.find((r) => r.label === 'Power-on display line 2');
    expect(line2?.value).toBe('LINE TWO');
    expect(line2?.address).toBe('0x3500920');

    const password = rows.find((r) => r.label === 'Power-on password (sensitive)');
    expect(password?.value).toBe('SECRET12');
    expect(password?.offset).toBe('+0x40');
    expect(password?.address).toBe('0x3500940');
    expect(password?.value).not.toBe(line2?.value);
  });
});

describe('localInfoRegisterPreview', () => {
  it('emits 16 LocalInfo register rows', () => {
    const data = new Uint8Array(D890_MAP.LocalInfoLength);
    data[0x10] = 0x41; // 'A'
    const rows = localInfoRegisterPreview(data);
    expect(rows).toHaveLength(0x100 / 0x10);
    expect(rows[0]?.address).toBe('0x4f80000');
    expect(rows[1]?.notes).toMatch(/radio type/);
    expect(rows[1]?.ascii.startsWith('A')).toBe(true);
  });
});
