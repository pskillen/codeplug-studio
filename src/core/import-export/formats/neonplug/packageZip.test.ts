import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildNeonplugZip } from './packageZip.ts';
import { NEONPLUG_JSON_FILE_NAME } from './serialise.ts';

describe('neonplug/packageZip', () => {
  it('packs codeplug.json as the sole ZIP entry', () => {
    const body = '{"version":"1.0.0","channels":[]}';
    const zip = buildNeonplugZip({ [NEONPLUG_JSON_FILE_NAME]: body });
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual([NEONPLUG_JSON_FILE_NAME]);
    expect(strFromU8(entries[NEONPLUG_JSON_FILE_NAME]!)).toBe(body);
  });

  it('throws when codeplug.json is missing', () => {
    expect(() => buildNeonplugZip({ 'other.json': '{}' })).toThrow(/codeplug\.json/);
  });
});
