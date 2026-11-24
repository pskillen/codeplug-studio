import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { EEPROM_IMAGE_END, FLASH_IMAGE_START } from '@integrations/radio-io/radios/radiofoundry/constants.ts';
import {
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_DEBUG_SUMS_SIDECAR,
  RADIOFOUNDRY_REGION,
} from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import { radioFoundryCoverage } from './RadioFoundryCoverage.tsx';
import type { DebugArchive } from '../captureArchive.ts';

function archive(): DebugArchive {
  return {
    source: 'file',
    manifest: {
      radioModelId: 'MD-9600-RadioFoundry',
      regions: [
        {
          id: RADIOFOUNDRY_REGION.eeprom,
          address: 0,
          byteLength: EEPROM_IMAGE_END,
          label: 'EEPROM',
          path: 'regions/eeprom-image.bin',
          restoreRole: 'inspect-only',
        },
        {
          id: RADIOFOUNDRY_REGION.flash,
          address: FLASH_IMAGE_START,
          byteLength: RADIOFOUNDRY_IMAGE_SIZE - FLASH_IMAGE_START,
          label: 'Flash',
          path: 'regions/flash-image.bin',
          restoreRole: 'inspect-only',
        },
      ],
    },
    regions: {},
    sidecars: {
      [RADIOFOUNDRY_DEBUG_INFO_SIDECAR]: new Uint8Array([
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
      [RADIOFOUNDRY_DEBUG_SUMS_SIDECAR]: new Uint8Array(9),
    },
  };
}

describe('radioFoundryCoverage', () => {
  it('renders the gap line and area 2 not-read text', () => {
    const view = radioFoundryCoverage(archive());
    expect(view).toBeDefined();
    render(<DesignSystemV2Provider>{view!.body}</DesignSystemV2Provider>);
    expect(
      screen.getByText(/calibration, settings ring and journal; the codeplug protocol never serves it/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not read \(tick 'Also read the DMR ID database area 2'\)/i)).toBeInTheDocument();
  });
});