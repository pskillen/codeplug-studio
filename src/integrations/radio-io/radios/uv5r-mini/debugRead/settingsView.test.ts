import { describe, expect, it } from 'vitest';
import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';
import { uv5rMiniSettingsView } from './settingsView.ts';

function archive(clone?: Uint8Array) {
  const decoded = new Uint8Array(UV5R_MINI_FULL_READ_SIZE);
  decoded.set([3, 1, 4, 3, 1, 8], 0x9000);
  decoded.set([1, 4, 6, 5, 2, 0, 0, 0], 0x8000);
  decoded.set([4, 3, 0, 1, 2, 5, 0, 0], 0x8020);
  return { regions: { clone: clone ?? decoded } };
}

describe('uv5rMiniSettingsView', () => {
  it('says not captured without a whole decoded clone', () => {
    expect(uv5rMiniSettingsView({ regions: {} }).status.kind).toBe('not-captured');
    expect(uv5rMiniSettingsView(archive(new Uint8Array(16))).status.kind).toBe('not-captured');
  });

  it('builds the settings frame and both VFO records with unique row ids', () => {
    const view = uv5rMiniSettingsView(archive());
    expect(view.status.kind).toBe('ok');
    expect(view.groups.map((g) => g.label)).toEqual(['Settings frame', 'VFO A', 'VFO B']);
    const rows = view.groups.flatMap((g) => g.rows);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.every((r) => r.address && r.raw)).toBe(true);
    expect(rows.some((r) => r.sensitive)).toBe(false);
  });

  it('carries the decoder default and the decoded values', () => {
    const view = uv5rMiniSettingsView(archive());
    const settings = view.groups[0]!.rows;
    const backlight = settings.find((r) => r.label === 'Backlight')!;
    expect(backlight.value).toBe('15 s');
    expect(backlight.firmwareDefault).toBe('3');
    expect(backlight.help).toContain('0 always on');
    expect(
      settings.some((r) => r.confidence === 'unused' && r.value === 'Unused (no reader)'),
    ).toBe(true);
    expect(settings.some((r) => r.confidence === 'partially-traced')).toBe(true);
    expect(view.groups[1]!.rows.find((r) => r.label.startsWith('Frequency'))?.value).toContain(
      '146.52000 MHz',
    );
  });

  it('flags a blank frame', () => {
    const blank = new Uint8Array(UV5R_MINI_FULL_READ_SIZE);
    expect(uv5rMiniSettingsView({ regions: { clone: blank } }).intro).toContain('reads the same');
  });
});
