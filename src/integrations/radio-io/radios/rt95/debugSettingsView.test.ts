import { describe, expect, it } from 'vitest';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { rt95SettingsView, type Rt95SettingsArchive } from './debugSettingsView.ts';

function archive(modelId = 'retevis-rt95'): Rt95SettingsArchive {
  const image = buildSyntheticRt95Image();
  return {
    manifest: {
      radioModelId: modelId,
      regions: [
        {
          id: 'programming-image',
          label: 'Clone',
          address: 0,
          byteLength: image.length,
          path: 'regions/programming-image.bin',
          restoreRole: 'inspect-only',
        },
      ],
    },
    regions: { 'programming-image': image },
  };
}

describe('rt95SettingsView', () => {
  it('refuses another radio archive', () => {
    expect(rt95SettingsView(archive('DM-32UV')).status.kind).toBe('not-captured');
  });

  it('builds every registered field once, with a confidence and no raw number in the value', () => {
    const view = rt95SettingsView(archive());
    expect(view.status.kind).toBe('ok');
    const rows = view.groups.flatMap((g) => g.rows);
    expect(rows).toHaveLength(73);
    expect(new Set(rows.map((r) => r.id)).size).toBe(73);
    expect(rows.every((r) => r.rawValue === undefined)).toBe(true);
    expect(rows.filter((r) => r.sensitive).map((r) => r.id)).toEqual(['powerOnPasswordDigits']);
    expect(view.trailing?.[0]?.rows.length).toBeGreaterThan(0);
  });
});
