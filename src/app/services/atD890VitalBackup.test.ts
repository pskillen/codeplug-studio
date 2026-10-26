import { describe, expect, it } from 'vitest';
import {
  AT_D890_VITAL_UNITS,
  AT_D890_VITAL_UNIT_BYTES,
  listAtD890NonFfRanges,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import {
  buildAtD890VitalManifest,
  packAtD890VitalZip,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackupZip.ts';
import { openAtD890VitalZip } from './atD890VitalBackup.ts';

function blank(): Uint8Array {
  const u = new Uint8Array(AT_D890_VITAL_UNIT_BYTES).fill(0xff);
  u.set([0x55, 0x55, 0xaa, 0xaa], AT_D890_VITAL_UNIT_BYTES - 4);
  return u;
}

describe('listAtD890NonFfRanges', () => {
  it('ignores the live marker and merges adjacent blocks', () => {
    const u = blank();
    expect(listAtD890NonFfRanges(u)).toEqual([]);
    u[0] = 1;
    u[0x10] = 1;
    u[0x100] = 2;
    expect(listAtD890NonFfRanges(u)).toEqual([
      { start: 0, end: 0x20 },
      { start: 0x100, end: 0x110 },
    ]);
  });
});

describe('openAtD890VitalZip', () => {
  it('summarises serial, range and per-unit hashes from a saved file', async () => {
    const li = blank();
    li[3] = 3;
    li.set(new TextEncoder().encode('SN42'), 0x30);
    const units = AT_D890_VITAL_UNITS.map((def) => ({
      def,
      bytes: def.id === 'local-info' ? li : blank(),
    }));
    const manifest = await buildAtD890VitalManifest({
      units,
      ident: new Uint8Array(16),
      capturedAt: '2026-10-26T10:00:00.000Z',
      app: { buildEnv: 'test', buildVersion: '0' },
      radioModelId: 'AT-D890UV',
    });
    const zip = packAtD890VitalZip(
      manifest,
      Object.fromEntries(units.map((u) => [u.def.id, u.bytes])),
    );
    const s = await openAtD890VitalZip(zip);
    expect(s.source).toBe('file');
    expect(s.serial).toBe('SN42');
    expect(s.rangeSummary).toContain('code 3');
    expect(s.units).toHaveLength(4);
    expect(s.units.every((u) => u.sha256.length === 64)).toBe(true);
    expect(s.localInfoRows.length).toBeGreaterThan(0);
  });
});
