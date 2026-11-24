import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { eepromWithSecretKey0305 } from '@integrations/radio-io/radios/radiofoundry/__fixtures__/settingsSector.ts';
import { RADIOFOUNDRY_REGION } from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { debugRadioPath, radioDebugDescriptors } from './descriptors.ts';
import { getDebugReadHistory } from './debugReadHistory.ts';

describe('RadioFoundry Settings tab', () => {
  it('masks a secret key until Show password', () => {
    const eeprom = eepromWithSecretKey0305();
    const archive = {
      source: 'live-read' as const,
      manifest: {
        capturedAt: '2026-03-01T12:00:00.000Z',
        radioModelId: 'MD-9600-RadioFoundry',
        regions: [
          {
            id: RADIOFOUNDRY_REGION.eeprom,
            address: 0,
            byteLength: eeprom.length,
            label: 'EEPROM',
            path: 'regions/eeprom-image.bin',
            restoreRole: 'inspect-only' as const,
          },
        ],
      },
      regions: { [RADIOFOUNDRY_REGION.eeprom]: eeprom },
      sidecars: {},
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
