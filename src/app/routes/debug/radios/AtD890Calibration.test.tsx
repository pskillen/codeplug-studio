import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
  type RadioBackupRegionV1,
} from '@integrations/radio-io/backup/index.ts';
import {
  AT_D890_VITAL_UNITS,
  AT_D890_VITAL_UNIT_BYTES,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import { AtD890Calibration, selectAtD890TuneRegion } from './AtD890Calibration.tsx';
import { archiveAtD890Capture } from './atD890Capture.ts';
import { openDebugArchive } from './captureArchive.ts';

/** Synthetic tune bytes: trim 0x07D0 (2000), UHF selection-0 table ramp, nothing from a real radio. */
function tune(length = AT_D890_VITAL_UNIT_BYTES, trim = 2000) {
  const b = new Uint8Array(length);
  const full = new Uint8Array(AT_D890_VITAL_UNIT_BYTES);
  full[0] = trim & 0xff;
  full[1] = trim >> 8;
  full[0x002] = 0x33;
  for (let i = 0; i < 121; i++) full[0xc00 + i] = i;
  b.set(full.subarray(0, length));
  return b;
}

function region(
  id: string,
  address: number,
  byteLength: number,
  overrides: Partial<RadioBackupRegionV1> = {},
): RadioBackupRegionV1 {
  return {
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole: 'inspect-only',
    ...overrides,
  };
}

function archive(
  entries: readonly [RadioBackupRegionV1, Uint8Array][],
  model = 'AT-D890UV',
  capturedAt = '2026-01-01',
) {
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt,
    capturedVia: 'file',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: model,
    descriptorLabel: 'test',
    coverage: 'partial',
    imageByteLength: 0x5000000,
    regions: entries.map(([r]) => r),
  };
  const zip = packRadioBackupZip(
    manifest,
    Object.fromEntries(entries.map(([r, bytes]) => [r.id, bytes])),
  );
  return openDebugArchive(zip, 'AT-D890UV');
}

const TUNE_A = 0x04f00000;
const view = (a: Parameters<typeof AtD890Calibration>[0]['archive']) =>
  render(
    <MantineProvider>
      <AtD890Calibration archive={a} />
    </MantineProvider>,
  );

describe('selectAtD890TuneRegion', () => {
  it('selects only vital-tune-a at its requested address', () => {
    const ok = selectAtD890TuneRegion(
      archive([[region('vital-tune-a', TUNE_A, 0x40), tune(0x40)]]),
    );
    expect(ok).toMatchObject({ status: 'ok', address: TUNE_A });
  });
  it('refuses a wrong address, role or model and does not decode other regions by label', () => {
    expect(
      selectAtD890TuneRegion(archive([[region('vital-tune-a', 0x04f40000, 16), tune(16)]])),
    ).toMatchObject({ status: 'refused' });
    expect(
      selectAtD890TuneRegion(
        archive([[region('vital-tune-a', TUNE_A, 16, { restoreRole: 'restorable' }), tune(16)]]),
      ),
    ).toMatchObject({ status: 'refused' });
    const a = archive([[region('vital-tune-a', TUNE_A, 16), tune(16)]]);
    expect(
      selectAtD890TuneRegion({ ...a, manifest: { ...a.manifest, radioModelId: 'retevis-rt95' } }),
    ).toMatchObject({ status: 'refused' });
    expect(
      selectAtD890TuneRegion(
        archive([[region('other', TUNE_A, 16, { label: 'Calibration (live)' }), tune(16)]]),
      ),
    ).toEqual({ status: 'not-captured', aliasPresent: false });
  });
  it('refuses malformed provenance: length mismatch or larger than one unit', () => {
    const a = archive([[region('vital-tune-a', TUNE_A, 16), tune(16)]]);
    expect(
      selectAtD890TuneRegion({
        ...a,
        manifest: {
          ...a.manifest,
          regions: [{ ...a.manifest.regions[0]!, byteLength: 32 }],
        },
      }),
    ).toMatchObject({ status: 'refused' });
    const big = new Uint8Array(AT_D890_VITAL_UNIT_BYTES + 16);
    expect(
      selectAtD890TuneRegion(archive([[region('vital-tune-a', TUNE_A, big.length), big]])),
    ).toMatchObject({ status: 'refused' });
  });
});

describe('AtD890Calibration', () => {
  it('shows Not captured with no archive, and for a tune-b-only alias response', () => {
    view(undefined);
    expect(screen.getByText('Not captured')).toBeInTheDocument();
    view(archive([[region('vital-tune-b', 0x04f40000, 32), tune(32)]]));
    expect(
      screen.getByText(/Calibration B \(as returned\) is present but is not used/),
    ).toBeInTheDocument();
  });

  it('decodes an offline archive with provenance, warnings and sources', () => {
    view(archive([[region('vital-tune-a', TUNE_A, AT_D890_VITAL_UNIT_BYTES), tune()]]));
    // One DOM walk instead of a getByText scan per string: each scan costs ~20 ms, and the
    // sequence made this the slowest test under load.
    const text = document.body.textContent ?? '';
    expect(text).toContain('Not validated on hardware');
    expect(text).toContain('V1.05 static trace');
    expect(text).toContain('Calibration (live) · 0x04F00000');
    expect(text).toMatch(/262144 of 262144 bytes/);
    expect(text).toContain('Local archive');
    expect(text.match(/Unknown/g)?.length).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/Little-endian assumed/);
    expect(text).toContain('2000');
    expect(text).toMatch(/0x08047E10/);
    expect(screen.getByLabelText('UHF power tables raw entries by index')).toBeInTheDocument();
    expect(
      screen.getByLabelText('VHF/220 squelch flatness raw entries by index'),
    ).toBeInTheDocument();
    expect(text.match(/visual guide only/g)).toHaveLength(4);
    expect(text).toMatch(/Partially decoded/);
    expect(screen.getByLabelText('Tune unit hexadecimal bytes').textContent).toContain(
      '0x04F00000',
    );
    expect(text).not.toMatch(/\b(watts?|dBm|ppm)\b/i);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByLabelText('Tune unit hexadecimal bytes').textContent).toContain(
      '0x04F00100',
    );
  });

  it('builds the numeric table only when its details are opened', () => {
    const { container } = view(
      archive([[region('vital-tune-a', TUNE_A, AT_D890_VITAL_UNIT_BYTES), tune()]]),
    );
    const details = screen.getAllByText('Numeric table')[0]!.closest('details')!;
    expect(details.querySelector('table')).toBeNull();
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(details.querySelector('table')).not.toBeNull();
  });

  it('keeps a partial prefix: half u16 unavailable, missing table entries not captured', () => {
    view(archive([[region('vital-tune-a', TUNE_A, 1), tune(1)]]));
    expect(screen.getByText(/1 of 262144 bytes \(partly captured\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No entries of these tables were captured.')).toHaveLength(4);
  });

  it('decodes a live-shaped archive the same as its reopened file archive', () => {
    // Only the tune A unit: packing and reopening every 256 KiB vital unit is what made this slow.
    const units = AT_D890_VITAL_UNITS.filter((def) => def.id === 'tune-a').map((def) => ({
      def,
      bytes: tune(AT_D890_VITAL_UNIT_BYTES, 1990),
    }));
    const live = archiveAtD890Capture({
      capturedAt: '2026-01-02T00:00:00.000Z',
      ident: { raw: new Uint8Array(16), model: 'ID890UV', version: 'V100', bandCode: 1 },
      cache: { blocks: new Map() },
      vital: { bothReadsMatched: true, units },
    });
    const file = openDebugArchive(live.zipBytes, 'AT-D890UV');
    const a = selectAtD890TuneRegion(live);
    const b = selectAtD890TuneRegion(file);
    expect(a.status).toBe('ok');
    expect(a).toEqual(b);
    view(live);
    expect(screen.getByText('Live read')).toBeInTheDocument();
    expect(screen.getByText('1990')).toBeInTheDocument();
  });

  it('refreshes values when the archive is replaced', () => {
    const first = archive([[region('vital-tune-a', TUNE_A, 16), tune(16, 1500)]]);
    const second = archive(
      [[region('vital-tune-a', TUNE_A, 16), tune(16, 2500)]],
      'AT-D890UV',
      '2026-01-03',
    );
    const { rerender } = view(first);
    expect(screen.getByText('1500')).toBeInTheDocument();
    rerender(
      <MantineProvider>
        <AtD890Calibration archive={second} />
      </MantineProvider>,
    );
    expect(screen.queryByText('1500')).not.toBeInTheDocument();
    expect(screen.getByText('2500')).toBeInTheDocument();
  });
});

it('overlays independently selected tune A captures and refuses tune B as a substitute', () => {
  const primary = archive(
    [[region('vital-tune-a', TUNE_A, 0x1000), tune(0x1000)]],
    'AT-D890UV',
    '2026-01-01',
  );
  const overlay = archive(
    [[region('vital-tune-a', TUNE_A, 0x1000), tune(0x1000, 1900)]],
    'AT-D890UV',
    '2026-01-02',
  );
  const { rerender } = render(
    <MantineProvider>
      <AtD890Calibration archive={primary} overlayArchive={overlay} />
    </MantineProvider>,
  );
  expect(screen.getAllByText(/Selected · 2026-01-01/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Overlay · 2026-01-02/).length).toBeGreaterThan(0);
  expect(document.querySelector('line[stroke-dasharray="4 3"]')).toBeTruthy();
  expect(screen.getAllByText('Overlay − primary').length).toBeGreaterThan(0);
  expect(screen.getByText('-100')).toBeInTheDocument();
  const tuneB = archive([[region('vital-tune-b', 0x04f40000, 32), tune(32)]]);
  rerender(
    <MantineProvider>
      <AtD890Calibration archive={primary} overlayArchive={tuneB} />
    </MantineProvider>,
  );
  expect(screen.getByText(/tune B is never substituted/)).toBeInTheDocument();
});
