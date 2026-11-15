import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
import {
  AT_D890_VITAL_UNITS,
  AT_D890_VITAL_UNIT_BYTES,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AtD890Compare } from './AtD890Compare.tsx';
import { AT_D890_PROVENANCE_PATH } from './atD890Provenance.ts';
import { openDebugArchive } from './captureArchive.ts';

const TUNE = AT_D890_VITAL_UNITS.find((u) => u.id === 'tune-a')!;

function tuneArchive(
  tune: number[],
  responding: string | null,
  extra?: { channels: boolean },
  capturedAt = '2026-01-01',
  sidecar = true,
) {
  const data = new Uint8Array(AT_D890_VITAL_UNIT_BYTES);
  data.set(tune);
  const regions = [
    {
      id: 'vital-tune-a',
      label: TUNE.label,
      address: TUNE.address,
      byteLength: data.length,
      path: 'regions/vital-tune-a.bin',
      restoreRole: 'inspect-only' as const,
    },
  ];
  const bytes: Record<string, Uint8Array> = { 'vital-tune-a': data };
  if (extra?.channels) {
    const bits = new Uint8Array(0x200);
    bits[0] = 1;
    regions.push({
      id: `sparse-${D890_MAP.ChannelSet.toString(16)}`,
      label: 'Sparse',
      address: D890_MAP.ChannelSet,
      byteLength: bits.length,
      path: 'regions/sparse-c.bin',
      restoreRole: 'inspect-only',
    });
    bytes[`sparse-${D890_MAP.ChannelSet.toString(16)}`] = bits;
  }
  const ranges = regions.map((r) => ({
    regionId: r.id,
    address: r.address,
    byteLength: r.byteLength,
    kind: r.id.startsWith('vital') ? 'vital' : 'sparse',
    requestedUnit: r.id.startsWith('vital') ? 'tune-a' : null,
    respondingUnit: r.id.startsWith('vital') ? responding : null,
    bothReadsMatched: r.id.startsWith('vital') ? true : null,
  }));
  return openDebugArchive(
    packRadioBackupZip(
      {
        format: RADIO_BACKUP_FORMAT,
        version: RADIO_BACKUP_VERSION,
        capturedAt,
        capturedVia: 'file',
        app: { buildEnv: 'test', buildVersion: 'test' },
        radioModelId: 'AT-D890UV',
        descriptorLabel: 'synthetic',
        coverage: 'partial',
        imageByteLength: 0x5000000,
        regions,
      },
      bytes,
      sidecar
        ? {
            [AT_D890_PROVENANCE_PATH]: new TextEncoder().encode(
              JSON.stringify({ version: 1, ranges }),
            ),
            'debug/vital.json': new TextEncoder().encode(
              JSON.stringify({ bothReadsMatched: true, units: AT_D890_VITAL_UNITS }),
            ),
          }
        : {},
    ),
    'AT-D890UV',
  );
}
const view = (a: ReturnType<typeof tuneArchive>, b: ReturnType<typeof tuneArchive>) =>
  render(
    <MantineProvider>
      <AtD890Compare first={a} second={b} />
    </MantineProvider>,
  );

describe('AtD890Compare', () => {
  it('shows Unknown for identical bytes, byte runs, and both capture times', () => {
    view(
      tuneArchive([1, 2], null, undefined, '2026-01-01'),
      tuneArchive([1, 3], null, undefined, '2026-02-02'),
    );
    expect(screen.getByText(/First capture: 2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/second capture: 2026-02-02/)).toBeInTheDocument();
    expect(screen.getByText(/1 changed bytes · responding unit: Unknown/)).toBeInTheDocument();
    expect(screen.getByText(/vital:tune-a · 0x04F00001 · 1 byte · 02 → 03/)).toBeInTheDocument();
    expect(
      screen.getByText('No differing acquisition claims in the compared ranges.'),
    ).toBeInTheDocument();
  });

  it('reports a different responding unit and the divergent claim separately from bytes', () => {
    view(tuneArchive([1], 'tune-a'), tuneArchive([1], 'local-info'));
    expect(
      screen.getByText(/0 changed bytes · responding unit: Different \(per archive claims\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/responding unit claim differ/)).toBeInTheDocument();
    expect(screen.getByText('No differing bytes in the comparable ranges.')).toBeInTheDocument();
  });

  it('refuses bytes when the claim is missing but still shows decoded differences', () => {
    view(
      tuneArchive([0xd0, 0x07], null, { channels: true }, '2026-01-01', false),
      tuneArchive([0xd1, 0x07], null, { channels: true }, '2026-01-02', false),
    );
    expect(screen.getByText('Provenance unavailable')).toBeInTheDocument();
    expect(screen.getByText('Decoded differences')).toBeInTheDocument();
    expect(screen.getByText(/value: 2000 → 2001/)).toBeInTheDocument();
  });

  it('pages changed runs and filters decoded domains with labelled controls', () => {
    const first = Array.from({ length: 200 }, () => 0);
    const second = first.map((_, i) => (i % 2 ? 0 : 1));
    view(tuneArchive(first, null), tuneArchive(second, null));
    expect(screen.getByText('Run page 1 of 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next Run page' }));
    expect(screen.getByText('Run page 2 of 4')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Show domain' })).toBeInTheDocument();
  });
});
