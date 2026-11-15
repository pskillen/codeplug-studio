import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { openDebugArchive } from './captureArchive.ts';
import { Coverage } from './Coverage.tsx';
import { Rt95Calibration } from './Rt95Calibration.tsx';

describe('RT95 calibration', () => {
  it('shows the evidence limits and absent values without write controls', () => {
    render(
      <DesignSystemV2Provider>
        <Rt95Calibration />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
    expect(screen.getByText(/MAIN V1.61/)).toBeInTheDocument();
    expect(screen.getByText(/stale or zero bytes/)).toHaveTextContent(
      'not proof of EEPROM contents',
    );
    expect(screen.getAllByText(/unmasked; firmware masks to 16 bits/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not captured/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /write|restore/i })).not.toBeInTheDocument();
  });
});

it('opens legacy and partial archives with honest availability and body provenance', () => {
  const image = {
    id: 'programming-image',
    label: 'Clone',
    address: 0,
    byteLength: 2,
    path: 'regions/image.bin',
    restoreRole: 'inspect-only' as const,
  };
  const calibration = {
    id: 'rt95-calibration',
    label: 'Calibration',
    address: 0x3b00,
    byteLength: 8,
    path: 'regions/rt95-calibration.bin',
    restoreRole: 'inspect-only' as const,
  };
  const manifest = {
    format: 'codeplug-studio-radio-backup' as const,
    version: 1 as const,
    capturedAt: '2026-01-01',
    capturedVia: 'file' as const,
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: 'retevis-rt95',
    descriptorLabel: 'RT95',
    coverage: 'partial' as const,
    imageByteLength: 2,
    regions: [image],
  };
  const old = openDebugArchive(
    packRadioBackupZip(manifest, { 'programming-image': new Uint8Array(2) }),
    'retevis-rt95',
  );
  const view = render(
    <DesignSystemV2Provider>
      <Rt95Calibration archive={old} />
    </DesignSystemV2Provider>,
  );
  expect(
    within(screen.getByText(/Model check text \[body\]/).parentElement!).getByText(/Not captured/),
  ).toBeInTheDocument();
  const partial = openDebugArchive(
    packRadioBackupZip(
      { ...manifest, regions: [image, calibration] },
      {
        'programming-image': new Uint8Array(2),
        'rt95-calibration': Uint8Array.of(65, 66, 0, 67, 68, 69, 70, 56),
      },
    ),
    'retevis-rt95',
  );
  view.rerender(
    <DesignSystemV2Provider>
      <Rt95Calibration archive={partial} />
    </DesignSystemV2Provider>,
  );
  expect(
    within(screen.getByText(/Model check text \[body\]/).parentElement!).getByText(
      /Raw: 41 42 00 43 44 45 46.*Text: AB.CDEF/,
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByText(/Stored version text \[body\]/).parentElement!).getByText(
      /Raw: 38 · partial.*Text: 8/,
    ),
  ).toBeInTheDocument();
  expect(screen.getByText(/head relays each block/)).toBeInTheDocument();
  for (const heading of screen.getAllByText(/\[body\].*0x[0-9A-F]{8}.*bytes/)) {
    expect(heading.parentElement).toHaveTextContent('[body]');
  }
  expect(screen.getByText(/\[body\] 0x00003B00/)).toBeInTheDocument();
});

it('reports the actual partial calibration span and uncaptured tail', () => {
  const region = {
    id: 'rt95-calibration',
    label: 'Calibration',
    address: 0x3b00,
    byteLength: 8,
    path: 'regions/rt95-calibration.bin',
    restoreRole: 'inspect-only' as const,
  };
  const archive = openDebugArchive(
    packRadioBackupZip(
      {
        format: 'codeplug-studio-radio-backup',
        version: 1,
        capturedAt: '2026-01-01',
        capturedVia: 'file',
        app: { buildEnv: 'test', buildVersion: 'test' },
        radioModelId: 'retevis-rt95',
        descriptorLabel: 'RT95',
        coverage: 'partial',
        imageByteLength: 8,
        regions: [region],
      },
      { 'rt95-calibration': new Uint8Array(8) },
    ),
    'retevis-rt95',
  );
  render(
    <DesignSystemV2Provider>
      <Coverage archive={archive} />
    </DesignSystemV2Provider>,
  );
  expect(screen.getByText(/captured 0x00003B00–0x00003B07/)).toBeInTheDocument();
  expect(screen.getByText(/0x00003B08–0x00003FBF not captured/)).toBeInTheDocument();
  expect(screen.getByText(/0x00003FC0–0x00003FF7 is outside this capture/)).toHaveTextContent(
    'Signature 0x00003FF8–0x00003FFF',
  );
});
