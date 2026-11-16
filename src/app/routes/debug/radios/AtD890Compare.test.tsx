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
import { RadioCompare } from './compare/RadioCompare.tsx';
import { radioDebugDescriptors } from './descriptors.ts';
import { AT_D890_PROVENANCE_PATH } from './atD890Provenance.ts';
import { openDebugArchive } from './captureArchive.ts';

const descriptor = radioDebugDescriptors.find((d) => d.slug === 'at-d890uv')!;
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
  });

  it('adds nothing when the claim is missing: the shared view already refuses', () => {
    view(
      tuneArchive([0xd0, 0x07], null, { channels: true }, '2026-01-01', false),
      tuneArchive([0xd1, 0x07], null, { channels: true }, '2026-01-02', false),
    );
    expect(screen.queryByText(/Provenance/)).toBeNull();
    expect(screen.queryByText(/Acquisition ranges/)).toBeNull();
  });

  it('shows each capture requested unit, responding unit and own repeat claim per range', () => {
    view(tuneArchive([1], 'tune-a'), tuneArchive([1], 'local-info'));
    expect(
      screen.getByText(
        'First: requested tune-a · responding unit: tune-a · repeat read matched (claim)',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Second: requested tune-a · responding unit: local-info · repeat read matched (claim)',
      ),
    ).toBeInTheDocument();
  });

  describe('password bytes', () => {
    const START = D890_MAP.OptionalSettingsExt + 0x3c;
    const sparseArchive = (fill: number, at = START, length = 16) => {
      const data = new Uint8Array(length).fill(fill);
      const region = {
        id: `sparse-${at.toString(16)}`,
        label: 'Sparse',
        address: at,
        byteLength: length,
        path: 'regions/sparse-opt.bin',
        restoreRole: 'inspect-only' as const,
      };
      return openDebugArchive(
        packRadioBackupZip(
          {
            format: RADIO_BACKUP_FORMAT,
            version: RADIO_BACKUP_VERSION,
            capturedAt: '2026-01-01',
            capturedVia: 'file',
            app: { buildEnv: 'test', buildVersion: 'test' },
            radioModelId: 'AT-D890UV',
            descriptorLabel: 'synthetic',
            coverage: 'partial',
            imageByteLength: 0x5000000,
            regions: [region],
          },
          { [`sparse-${at.toString(16)}`]: data },
          {
            [AT_D890_PROVENANCE_PATH]: new TextEncoder().encode(
              JSON.stringify({
                version: 1,
                ranges: [
                  {
                    regionId: `sparse-${at.toString(16)}`,
                    address: at,
                    byteLength: length,
                    kind: 'sparse',
                    requestedUnit: null,
                    respondingUnit: null,
                    bothReadsMatched: null,
                  },
                ],
              }),
            ),
          },
        ),
        'AT-D890UV',
      );
    };

    const shell = (a: ReturnType<typeof tuneArchive>, b: ReturnType<typeof tuneArchive>) =>
      render(
        <MantineProvider>
          <RadioCompare descriptor={descriptor} a={a} b={b} />
        </MantineProvider>,
      );

    it('masks each side from its own region when the reads chunk the span differently', () => {
      // A holds the span in a 16-byte region, B in a wider region with a different id.
      shell(sparseArchive(0x31), sparseArchive(0x32, START - 0x10, 48));
      const hex = () => screen.getByRole('group', { name: 'Hex diff' }).textContent ?? '';
      expect(hex()).toContain('[masked bytes differ]');
      expect(hex()).not.toMatch(/32 32 32 32 32/);
      expect(hex()).not.toMatch(/31 31 31 31 31/);
    });

    it('masks a changed power-on password in the shared hex diff until revealed', () => {
      shell(sparseArchive(0x31), sparseArchive(0x32));
      const hex = () => screen.getByRole('group', { name: 'Hex diff' }).textContent ?? '';
      expect(hex()).toContain('••');
      expect(hex()).toContain('[masked bytes differ]');
      expect(hex()).toContain('31 31 31 31');
      expect(hex()).not.toMatch(/31 31 31 31 31/);
      // The decoded view marks the password as changed without its value.
      expect(screen.getAllByRole('table', { name: /fields/ }).length).toBeGreaterThan(0);
      fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]!);
      expect(hex()).not.toContain('••');
      expect(hex()).toContain('31 31 31 31 31 31 31 31 31 31 31 31');
      expect(hex()).not.toContain('[masked bytes differ]');
    });
  });
});

describe('D890 on the shared compare', () => {
  const shell = (a: ReturnType<typeof tuneArchive>, b: ReturnType<typeof tuneArchive>) =>
    render(
      <MantineProvider>
        <RadioCompare descriptor={descriptor} a={a} b={b} />
      </MantineProvider>,
    );

  it('shows the summary, the hex diff and the provenance panel', () => {
    shell(tuneArchive([1, 2], null), tuneArchive([1, 3], null));
    expect(screen.getByText('A and B differ')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Hex diff' })).toBeInTheDocument();
    expect(screen.getByText('Provenance limits')).toBeInTheDocument();
  });

  it('is identical when the bytes match, whatever the claims say', () => {
    shell(tuneArchive([1], 'tune-a'), tuneArchive([1], 'local-info'));
    expect(screen.getByText('Identical')).toBeInTheDocument();
    expect(screen.getByText(/responding unit claim differ/)).toBeInTheDocument();
  });

  it('refuses bytes without a claim with one alert and keeps the decoded differences', () => {
    shell(
      tuneArchive([0xd0, 0x07], null, { channels: true }, '2026-01-01', false),
      tuneArchive([0xd1, 0x07], null, { channels: true }, '2026-01-02', false),
    );
    expect(screen.getByText('Cannot compare')).toBeInTheDocument();
    // The shell's alert is the only one: no second "Provenance unavailable" panel.
    expect(screen.queryByText('Provenance limits')).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByText('Decoded changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByRole('option', { name: /Calibration/ }));
    const trim = screen.getByRole('group', { name: 'Oscillator trim' });
    expect(trim).toHaveTextContent('changed');
    expect(trim).toHaveTextContent(/20002001/);
  });

  it('shows the responding-unit limits once, collapsed, from the adapter notes', () => {
    shell(tuneArchive([1, 2], null), tuneArchive([1, 3], null));
    expect(screen.getAllByText('Responding unit unknown')).toHaveLength(1);
  });
});
