import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { packRadioBackupZip } from '@integrations/radio-io/backup/pack.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/types.ts';
import { DM32_FACTORY_SECTOR_ADDRESS } from '@integrations/radio-io/radios/dm32uv/constants.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import type { RadioBackupSession } from '../../services/radioBackupRestore.ts';
import Dm32CalibrationBackupPanel from './Dm32CalibrationBackupPanel.tsx';

const LIVE_ADDRESS = 0xb8000;

function session(): RadioBackupSession {
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-10-20T12:00:00.000Z',
    capturedVia: 'file',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'DM-32UV',
    descriptorLabel: 'Baofeng DM-32UV',
    coverage: 'known-map-regions',
    imageByteLength: 4,
    regions: [
      {
        id: 'calibration-live',
        label: 'Live calibration page',
        address: LIVE_ADDRESS,
        byteLength: 4,
        path: 'regions/calibration-live.bin',
        restoreRole: 'inspect-only',
      },
      {
        id: 'factory-sector',
        label: 'Factory sector (inspect only)',
        address: DM32_FACTORY_SECTOR_ADDRESS,
        byteLength: 4,
        path: 'regions/factory-sector.bin',
        restoreRole: 'inspect-only',
      },
    ],
  };
  const calibration = {
    liveAddress: LIVE_ADDRESS,
    tag: 0x02,
    duplicateAddresses: [0xc0000],
    sha256: 'abc',
    decoded: {
      address: LIVE_ADDRESS,
      tag: 0x02,
      uhfBand: { lowHz: 400_000_000, highHz: 470_000_000 },
      vhfBand: { lowHz: 136_000_000, highHz: 174_000_000 },
      frequencyPointsHz: {
        uhfRx: [400_000_000],
        uhfTx: [400_000_000],
        vhfRx: [136_000_000],
        vhfTx: [136_000_000],
      },
      uhfPower: { low: [1], mid: [2], high: [3] },
      vhfPower: { low: [4], mid: [5], high: [6] },
      levels: {
        uhf: [{ level1: [1], level9: [9] }],
        vhf: [{ level1: [1], level9: [9] }],
        airband: { level1: [1], level9: [9] },
      },
      maskedAdjust: { at0x00c: 1, at0x00e: 1, at0x00cValid: true, at0x00eValid: true },
      bootScalars: [],
      unknownRows: [{ offset: 0x017, length: 5, hex: '1122334455' }],
    },
    unknownRows: [{ offset: 0x017, length: 5, hex: '1122334455' }],
    efuseUidHex: '0102030405060708',
    efuseDerivedHex: null,
  };
  const factory = {
    kept: true,
    address: DM32_FACTORY_SECTOR_ADDRESS,
    sha256: 'def',
    decoded: {
      address: DM32_FACTORY_SECTOR_ADDRESS,
      gpsEnabled: true,
      txRegion: 0xa5,
      txRegionUnrestricted: true,
      optionBytes: [],
      antiCloneKeyHex: '01020304',
    },
  };
  return {
    source: 'file',
    manifest,
    image: createMemoryMap(4),
    zipBytes: packRadioBackupZip(manifest, {
      'calibration-live': new Uint8Array([1, 2, 3, 4]),
      'factory-sector': new Uint8Array([5, 6, 7, 8]),
    }),
    dm32CalibrationJson: JSON.stringify(calibration),
    dm32FactoryJson: JSON.stringify(factory),
  };
}

describe('Dm32CalibrationBackupPanel', () => {
  it('shows the live page and an inspect-only factory sector with no restore control', () => {
    render(
      <MantineProvider>
        <Dm32CalibrationBackupPanel session={session()} />
      </MantineProvider>,
    );

    expect(screen.getByText(/0xb8000/)).toBeTruthy();
    expect(screen.getByText('1122334455')).toBeTruthy();
    expect(screen.getByText(/The lower address is the live calibration page/)).toBeTruthy();
    expect(screen.getByText(/eFuse identity/)).toBeTruthy();
    expect(screen.getAllByText(/Inspect only/).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(DM32_FACTORY_SECTOR_ADDRESS.toString(16)))).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /restore/i })).toBeNull();
  });
});
