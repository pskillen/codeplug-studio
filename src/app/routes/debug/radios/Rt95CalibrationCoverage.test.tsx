import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { openDebugArchive } from './captureArchive.ts';
import { Coverage } from './Coverage.tsx';

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
  expect(screen.getByText(/MMD1 EEPROM.*0 of 8192 bytes captured/)).toHaveTextContent(
    '0x00004000–0x00005FFF',
  );
  expect(screen.getByText(/MMD1 0x00004000–0x00005FFF not captured/)).toBeInTheDocument();
  expect(screen.getByText(/captured 0x00003B00–0x00003B07/)).toBeInTheDocument();
  expect(screen.getByText(/0x00003B08–0x00003FBF not captured/)).toBeInTheDocument();
  expect(
    screen.getByText(/0x00003FC0–0x00003FF7 is outside the calibration capture/),
  ).toHaveTextContent('Signature 0x00003FF8–0x00003FFF');
});
