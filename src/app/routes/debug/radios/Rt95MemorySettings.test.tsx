import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { RT95_POWER_ON_PASSWORD_ADDRESS } from '@integrations/radio-io/radios/rt95/constants.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import { openDebugArchive } from './captureArchive.ts';
import { Rt95Memory } from './Rt95Memory.tsx';

function cloneArchive() {
  const clone = buildSyntheticRt95Image();
  clone.set([0x39, 0x38, 0x37, 0x36, 0x35, 0x34], RT95_POWER_ON_PASSWORD_ADDRESS);
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt: '2026-01-01',
    capturedVia: 'file',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: 'retevis-rt95',
    descriptorLabel: 'test',
    coverage: 'partial',
    imageByteLength: clone.length,
    regions: [
      {
        id: 'programming-image',
        label: 'Clone',
        address: 0,
        byteLength: clone.length,
        path: 'regions/programming-image.bin',
        restoreRole: 'inspect-only',
      },
    ],
  };
  return openDebugArchive(
    packRadioBackupZip(manifest, { 'programming-image': clone }, {}),
    'retevis-rt95',
  );
}

const view = () =>
  render(
    <MantineProvider>
      <Rt95Memory archive={cloneArchive()} />
    </MantineProvider>,
  );

afterEach(cleanup);

describe('RT95 settings view', () => {
  it('shows all 73 registered fields with trust and the unclaimed runs', () => {
    view();
    expect(screen.getByText(/73 of 73 registered setting fields captured/)).toBeInTheDocument();
    expect(screen.getByText(/135 of 512 settings bytes claimed by no field/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Function setup' })).getAllByRole('row').length,
    ).toBeGreaterThan(1);
    const total = screen
      .getAllByRole('table')
      .filter((t) => /settings$/.test(t.getAttribute('aria-label') ?? ''))
      .reduce((n, t) => n + within(t).getAllByRole('row').length - 1, 0);
    expect(total).toBe(73);
    expect(screen.getAllByText('CPS+CHIRP').length).toBeGreaterThan(0);
    const unclaimed = screen.getByRole('region', { name: 'Unclaimed bytes' });
    expect(
      within(unclaimed).getByText(
        /42 bytes with a meaning, 93 unused \(no reader\), 0 still unknown/,
      ),
    ).toBeInTheDocument();
    expect(within(unclaimed).getByText(/Side A channel index · traced/)).toBeInTheDocument();
    expect(within(unclaimed).getAllByText(/Unused \(no reader\) · unused/).length).toBeGreaterThan(
      0,
    );
  });

  it('filters by search', () => {
    view();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search settings' }), {
      target: { value: 'vox delay' },
    });
    expect(screen.getAllByText('VOX Delay').length).toBeGreaterThan(0);
    expect(screen.queryByText('Beep Volume')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search settings' }), {
      target: { value: 'zzzz-nothing' },
    });
    expect(screen.getByText(/No settings match/)).toBeInTheDocument();
  });

  it('masks the power-on password until revealed', () => {
    view();
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    expect(screen.queryByText('987654')).not.toBeInTheDocument();
    expect(screen.queryByText(/39 38 37 36 35 34/)).not.toBeInTheDocument();
    expect(screen.getByText('Hidden (power-on password)')).toBeInTheDocument();
    expect(screen.getByText('•• •• •• •• •• ••')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByText('987654')).toBeInTheDocument();
    expect(screen.getByText('39 38 37 36 35 34')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.queryByText('987654')).not.toBeInTheDocument();
  });
});
