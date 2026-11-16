import { describe, expect, it } from 'vitest';
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import { D890_MAP } from './constants.ts';
import { AT_D890_FIELD_CONFIDENCE } from './debugSettingsConfidence.ts';
import { AT_D890_SETTINGS_FIELDS } from './settingsFields.ts';
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

describe('AT-D890 field confidence map', () => {
  it('covers every registered field and only registered fields', () => {
    expect(Object.keys(AT_D890_FIELD_CONFIDENCE).sort()).toEqual(
      [...AT_D890_SETTINGS_FIELDS.keys()].sort(),
    );
  });

  it('shows traced, partial and evidence on rows, even when not captured', () => {
    const rows = rowsOf(archive([]));
    const key = rows.find((r) => r.id === 'keyTone');
    expect(key?.confidence).toBe('traced');
    expect(key?.evidence).toContain('clamp');
    expect(rows.find((r) => r.id === 'displayMode')?.confidence).toBe('partially-traced');
  });
});
