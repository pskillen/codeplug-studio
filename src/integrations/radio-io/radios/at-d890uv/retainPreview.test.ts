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
    expect(rows.find((r) => r.label === 'Frequency mode')?.value).toBe('2');
    expect(rows.find((r) => r.label.startsWith('Chinese UI'))?.value).toMatch(/Chinese/);
    expect(rows.find((r) => r.label === 'Band-settings password')?.value).toBe('1234');
    expect(rows.find((r) => r.label === 'Radio type')?.value).toBe('D890UV');
    expect(rows.find((r) => r.label === 'Program password')?.value).toBe('ABCD');
    expect(rows.find((r) => r.label === 'Serial number')?.value).toBe('SN1234567890');
  });
});

describe('optionalSettingsRetainPreview', () => {
  it('decodes language, password enable, and password chars', () => {
    const main = new Uint8Array(D890_MAP.OptionalSettingsMainLength);
    const ext = new Uint8Array(D890_MAP.OptionalSettingsExtLength);
    main[0x05] = 1; // German
    main[0x07] = 1; // password on
    ext.set(new TextEncoder().encode('SECRET12'), 0x20);

    const rows = optionalSettingsRetainPreview(main, ext);
    expect(rows.find((r) => r.label === 'CPS language')?.value).toBe('German');
    expect(rows.find((r) => r.label === 'Power-on password enable')?.value).toBe('On');
    expect(rows.find((r) => r.label === 'Power-on password (sensitive)')?.value).toBe('SECRET12');
    expect(rows.find((r) => r.label === 'Chinese UI (Expert options)')?.value).toMatch(
      /Local info/,
    );
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
