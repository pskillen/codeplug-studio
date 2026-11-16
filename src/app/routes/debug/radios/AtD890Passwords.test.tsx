import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
  type RadioBackupRegionV1,
} from '@integrations/radio-io/backup/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { atD890SettingsView } from '@integrations/radio-io/radios/at-d890uv/debugSettingsView.ts';
import { SettingsTab } from './SettingsTab.tsx';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { hexRows, sensitiveRanges } from './viewerUtils.ts';

const POWER_ON = D890_MAP.OptionalSettingsExt + 0x40;
const PROGRAM = D890_MAP.LocalInfo + 0x28;
const BAND = D890_MAP.LocalInfo + 0x0b;
const ascii = (text: string, length: number) => {
  const out = new Uint8Array(length);
  [...text].forEach((c, i) => (out[i] = c.charCodeAt(0)));
  return out;
};

type Entry = [RadioBackupRegionV1, Uint8Array];
const sparse = (address: number, data: Uint8Array): Entry => [
  {
    id: `sparse-${address.toString(16)}`,
    label: 'Sparse configuration',
    address,
    byteLength: data.length,
    path: `regions/sparse-${address.toString(16)}.bin`,
    restoreRole: 'inspect-only',
  },
  data,
];
function archive(entries: readonly Entry[], modelId = 'AT-D890UV'): DebugArchive {
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt: '2026-01-01',
    capturedVia: 'file',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: modelId,
    descriptorLabel: 'test',
    coverage: 'partial',
    imageByteLength: 0x5000000,
    regions: entries.map(([r]) => r),
  };
  return openDebugArchive(
    packRadioBackupZip(manifest, Object.fromEntries(entries.map(([r, b]) => [r.id, b]))),
    modelId,
  );
}

const entries = () => [
  sparse(D890_MAP.OptionalSettingsMain + 0x07, Uint8Array.of(1)),
  sparse(POWER_ON, ascii('1234', 8)),
  sparse(PROGRAM, ascii('1234', 4)),
  sparse(BAND, ascii('1234', 4)),
];
const show = (a: DebugArchive) =>
  render(
    <MantineProvider>
      <SettingsTab archive={a} settings={atD890SettingsView} />
    </MantineProvider>,
  );

describe('AT-D890UV passwords', () => {
  it('masks all three passwords by default', () => {
    show(archive(entries()));
    const privacy = screen.getByRole('table', { name: 'Privacy / lock settings' });
    expect(within(privacy).getAllByText('Hidden (password)')).toHaveLength(3);
    expect(privacy.textContent).not.toContain('1234');
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    expect(privacy.textContent).not.toMatch(/31 32 33 34/);
    expect(privacy.textContent).toContain('•• •• •• ••');
  });

  it('decodes them on reveal and hides them again', () => {
    show(archive(entries()));
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    const privacy = screen.getByRole('table', { name: 'Privacy / lock settings' });
    expect(within(privacy).getAllByText('1234')).toHaveLength(3);
    expect(within(privacy).getByText('Decode program password')).toBeInTheDocument();
    expect(within(privacy).getByText('Band-settings password')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(privacy.textContent).not.toContain('1234');
  });

  it('says Not captured when a LocalInfo password was not read', () => {
    show(archive([sparse(POWER_ON, ascii('1234', 8))]));
    const privacy = screen.getByRole('table', { name: 'Privacy / lock settings' });
    expect(within(privacy).getAllByText('Not captured').length).toBeGreaterThanOrEqual(2);
  });

  it('masks the password bytes in Hex and leaves the archive bytes unchanged', () => {
    const a = archive(entries());
    const id = a.manifest.regions.find((r) => r.address === PROGRAM)!.id;
    const mask = sensitiveRanges(a, id);
    expect(mask).toEqual([{ start: PROGRAM, end: PROGRAM + 4, label: 'Decode program password' }]);
    const [row] = hexRows(a.regions[id]!, PROGRAM, 0, mask);
    expect(row!.hex).toBe('•• •• •• ••');
    expect(row!.ascii).toBe('••••');
    expect(Array.from(a.regions[id]!)).toEqual([0x31, 0x32, 0x33, 0x34]);
    const powerId = a.manifest.regions.find((r) => r.address === POWER_ON)!.id;
    expect(sensitiveRanges(a, powerId)).toHaveLength(1);
    expect(Array.from(a.regions[powerId]!.subarray(0, 4))).toEqual([0x31, 0x32, 0x33, 0x34]);
  });

  it('masks the LocalInfo offsets inside the vital units that may mirror LocalInfo', () => {
    const unit = (id: string, address: number): Entry => [
      {
        id,
        label: id,
        address,
        byteLength: 0x100,
        path: `regions/${id}.bin`,
        restoreRole: 'inspect-only',
      },
      new Uint8Array(0x100),
    ];
    const a = archive([
      unit('vital-tune-b', 0x04f4_0000),
      unit('vital-local-info-upper', 0x04fc_0000),
      unit('vital-tune-a', 0x04f0_0000),
    ]);
    expect(sensitiveRanges(a, 'vital-tune-b').map((r) => [r.start, r.end])).toEqual([
      [0x04f4_0028, 0x04f4_002c],
      [0x04f4_000b, 0x04f4_000f],
    ]);
    expect(sensitiveRanges(a, 'vital-local-info-upper')).toHaveLength(2);
    expect(sensitiveRanges(a, 'vital-tune-a')).toEqual([]);
  });

  it('reports no D890 ranges for another radio archive', () => {
    const a = archive(entries(), 'DM-32UV');
    const id = a.manifest.regions.find((r) => r.address === BAND)!.id;
    expect(sensitiveRanges(a, id)).toEqual([]);
  });
});
