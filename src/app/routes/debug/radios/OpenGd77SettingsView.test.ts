import { describe, expect, it } from 'vitest';
import { OPENGD77_DM1701_MODEL_ID } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { openGd77SettingsView } from '@integrations/radio-io/radios/opengd77/debugSettingsView.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';

describe('openGd77SettingsView', () => {
  it('builds the firmware struct and the codeplug groups, with the two passwords sensitive', async () => {
    const view = openGd77SettingsView(await syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID));
    expect(view.status.kind).toBe('ok');
    expect(view.groups[0]!.label).toBe('Firmware settings');
    expect(view.groups.map((g) => g.label)).toContain('Codeplug General settings (0xE0)');
    const rows = view.groups.flatMap((g) => g.rows);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.filter((r) => r.sensitive).map((r) => r.id)).toEqual([
      'general-prgPwd',
      'general-bootPasswordPin',
    ]);
  });

  it('says not captured when the archive model has no identified FirmwareInfo', async () => {
    const archive = await syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID);
    const view = openGd77SettingsView({ ...archive, sidecars: {} });
    expect(view.status.kind).toBe('not-captured');
  });
});
