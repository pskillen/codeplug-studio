import { describe, expect, it } from 'vitest';
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import { D890_MAP } from './constants.ts';
import { atD890SettingsView, type AtD890SettingsArchive } from './debugSettingsView.ts';

function archive(
  entries: readonly [number, Uint8Array][],
  modelId = 'AT-D890UV',
): AtD890SettingsArchive {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  for (const [address, data] of entries) {
    const id = `sparse-${address.toString(16)}`;
    regions.push({
      id,
      label: 'Sparse configuration',
      address,
      byteLength: data.length,
      path: `regions/${id}.bin`,
      restoreRole: 'inspect-only',
    });
    bytes[id] = data;
  }
  return { manifest: { radioModelId: modelId, regions }, regions: bytes };
}

const rowsOf = (a: AtD890SettingsArchive) => atD890SettingsView(a).groups.flatMap((g) => g.rows);

describe('atD890SettingsView', () => {
  it('refuses another radio archive', () => {
    expect(atD890SettingsView(archive([], 'DM-32UV')).status.kind).toBe('not-captured');
  });

  it('keeps passwords sensitive with raw bytes unmasked', () => {
    const rows = rowsOf(
      archive([
        [D890_MAP.LocalInfo + 0x28, Uint8Array.of(0x31, 0x32, 0x33, 0x34)],
        [D890_MAP.OptionalSettingsMain + 0x26, Uint8Array.of(2)],
      ]),
    );
    const program = rows.find((r) => r.label === 'Decode program password');
    expect(program?.sensitive).toBe(true);
    expect(program?.value).toBe('1234');
    expect(program?.raw).toEqual([0x31, 0x32, 0x33, 0x34]);
    expect(rows.every((r) => r.rawValue === undefined)).toBe(true);
  });

  it('says a missing block is not captured, not a default', () => {
    const rows = rowsOf(archive([]));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.value === undefined)).toBe(true);
  });
});
