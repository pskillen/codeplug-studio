import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import { DM32_SETTINGS_FIELDS, DM32_SETTINGS_GROUPS } from './debugMemorySettings.ts';
import { dm32SettingsView } from './debugSettingsView.ts';

const BASE = 0x1000;
const TE = new TextEncoder();

function page(tag: number): Uint8Array {
  const data = new Uint8Array(4096);
  data[0xfff] = tag;
  return data;
}

function archive(pages: Record<number, Uint8Array>, modelId = 'DM-32UV'): Dm32CompareArchive {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  for (const [addr, data] of Object.entries(pages)) {
    const id = `sparse-${Number(addr).toString(16)}`;
    regions.push({
      id,
      label: 'Sparse',
      address: Number(addr),
      byteLength: data.length,
      path: `regions/${id}.bin`,
      restoreRole: 'inspect-only',
    });
    bytes[id] = data;
  }
  const manifest = {
    format: 'radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00.000Z',
    radioModelId: modelId,
    coverage: 'partial',
    addressBase: BASE,
    imageByteLength: 12 * 0x1000,
    regions,
  } as unknown as RadioBackupManifestV1;
  return {
    manifest,
    regions: bytes,
    sidecars: {
      [DM32_DEBUG_CAPTURE_PATH]: TE.encode(
        JSON.stringify({
          modelString: 'DP570UV',
          v0a: { start: BASE, end: BASE + 12 * 0x1000 - 1 },
          window: { start: BASE, end: BASE + 11 * 0x1000 },
          discovered: Object.entries(pages).map(([a, d]) => ({
            address: Number(a),
            tag: d[0xfff],
          })),
          channelCount: 0,
          extraReadTags: [],
          factory: { status: 'not-kept', reason: 'mismatch' },
        }),
      ),
    },
  };
}

describe('dm32SettingsView', () => {
  it('builds every registered field into its group, with the page evidence', () => {
    const settings = page(0x04);
    settings[0x1e] = 3;
    const view = dm32SettingsView(archive({ [BASE]: settings }));
    expect(view.status).toEqual({ kind: 'ok' });
    expect(view.groups.map((g) => g.label)).toEqual(DM32_SETTINGS_GROUPS.map((g) => g.label));
    const rows = view.groups.flatMap((g) => g.rows);
    expect(rows).toHaveLength(DM32_SETTINGS_FIELDS.length);
    const auto = rows.find((r) => r.label === 'Auto power off');
    expect(auto).toMatchObject({
      value: '120 minutes',
      evidence: expect.stringContaining('settings.md'),
    });
    expect(auto?.address).toBe('0x0000101E');
    expect(auto?.raw).toEqual([3]);
    expect(view.summary).toMatch(/known setting fields captured/);
    expect(view.intro).toMatch(/Read-only view of the settings page at 0x00001000 \(tag 0x04\)/);
    expect(view.intro).toMatch(/Emergency systems and encryption keys/);
    expect(view.trailing?.map((t) => t.id)).toEqual(['documented', 'unused', 'unknown']);
  });

  it('marks the password rows sensitive and keeps their raw bytes', () => {
    const settings = page(0x04);
    settings.set(TE.encode('12345678'), 0x431);
    const view = dm32SettingsView(archive({ [BASE]: settings }));
    const secret = view.groups.flatMap((g) => g.rows).filter((r) => r.sensitive);
    expect(secret).toHaveLength(3);
    expect(secret.some((r) => r.raw?.includes(0x31))).toBe(true);
  });

  it('gives a missing page a reason and no rows, never defaults', () => {
    const view = dm32SettingsView(archive({ [BASE]: page(0x12) }));
    expect(view.status).toEqual({
      kind: 'not-captured',
      reason: 'No accepted block tagged 0x04 was captured.',
    });
    expect(view.groups).toEqual([]);
  });

  it('lists the pages when several carry the settings tag', () => {
    const view = dm32SettingsView(archive({ [BASE]: page(0x04), [BASE + 0x1000]: page(0x04) }));
    expect(view.status.kind).toBe('ambiguous');
    if (view.status.kind === 'ambiguous') {
      expect(view.status.reason).toMatch(/Several pages tagged 0x04, not decoded\. Addresses: /);
      expect(view.status.reason).toContain('0x00001000');
    }
  });

  it('refuses another radio model', () => {
    const view = dm32SettingsView(archive({ [BASE]: page(0x04) }, 'AT-D890UV'));
    expect(view.status.kind).toBe('not-captured');
    expect(view.groups).toEqual([]);
  });
});
