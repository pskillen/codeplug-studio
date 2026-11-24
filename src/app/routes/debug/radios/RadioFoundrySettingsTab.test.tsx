import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { SETTINGS_AREA_ADDRESS, SETTINGS_AREA_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import { crc32 } from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import { EEPROM_IMAGE_END } from '@integrations/radio-io/radios/radiofoundry/constants.ts';
import { RADIOFOUNDRY_REGION } from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { debugRadioPath, radioDebugDescriptors } from './descriptors.ts';
import { getDebugReadHistory } from './debugReadHistory.ts';

function buildSector(data: number[]): Uint8Array {
  const s = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  const crc = crc32(Uint8Array.from(data));
  s.set([0x52, 0x46, 0x4b, 0x56, 1, 16, data.length & 0xff, data.length >> 8], 0);
  s.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], 8);
  s.set(data, 16);
  return s;
}

describe('RadioFoundry Settings tab', () => {
  it('masks a secret key until Show password', () => {
    const sector = buildSector([0x05, 0x03, 0x04, 0x00, 0xde, 0xad, 0xbe, 0xef]);
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
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