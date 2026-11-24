import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { eepromWithSecretKey0305 } from '@integrations/radio-io/radios/radiofoundry/__fixtures__/settingsSector.ts';
import { RADIOFOUNDRY_REGION } from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { openDebugArchive } from './captureArchive.ts';
import { debugRadioPath, radioDebugDescriptors } from './descriptors.ts';
import { getDebugReadHistory } from './debugReadHistory.ts';

describe('RadioFoundry Settings tab', () => {
  it('masks a secret key until Show password', () => {
    const eeprom = eepromWithSecretKey0305();
    const manifest: RadioBackupManifestV1 = {
      format: RADIO_BACKUP_FORMAT,
      version: RADIO_BACKUP_VERSION,
      capturedAt: '2026-03-01T12:00:00.000Z',
      capturedVia: 'web-serial',
      app: { buildEnv: 'test', buildVersion: 'test' },
      descriptorLabel: 'test',
      coverage: 'partial',
      imageByteLength: eeprom.length,
      radioModelId: 'MD-9600-RadioFoundry',
      regions: [
        {
          id: RADIOFOUNDRY_REGION.eeprom,
          address: 0,
          byteLength: eeprom.length,
          label: 'EEPROM',
          path: 'regions/eeprom-image.bin',
          restoreRole: 'inspect-only',
        },
      ],
    };
    const archive = {
      ...openDebugArchive(
        packRadioBackupZip(manifest, { [RADIOFOUNDRY_REGION.eeprom]: eeprom }, {}),
        'MD-9600-RadioFoundry',
      ),
      source: 'live-read' as const,
    };
    const slug = 'md-9600-radiofoundry';
    getDebugReadHistory({ slug, archiveModelId: 'MD-9600-RadioFoundry' }).add(archive);
    render(
      <MemoryRouter
        initialEntries={[debugRadioPath(radioDebugDescriptors.find((d) => d.slug === slug)!)!]}
      >
        <DesignSystemV2Provider>
          <Routes>
            <Route path="/debug/radios/:radio/:firmware" element={<RadioDebugPage />} />
          </Routes>
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByText(/Key 0x0305/)).toBeInTheDocument();
    expect(screen.queryByText(/de ad be ef/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByText(/de ad be ef/i)).toBeInTheDocument();
  });
});
