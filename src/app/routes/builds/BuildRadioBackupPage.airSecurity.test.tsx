/**
 * Backup page: warn when an AT-D890UV backup already holds an AirSecurity seed.
 * The bytes stay in the backup; the page does not read a radio and does not show them.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import {
  AIRSECURITY_SEED_ADDRESS,
  AIRSECURITY_SEED_RECORD_LENGTH,
  encodeAirSecuritySeedRecord,
} from '@integrations/radio-io/radios/at-d890uv/airSecuritySeed.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import type { MemoryMap } from '@integrations/radio-io/types.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import type { RadioBackupSession } from '../../services/radioBackupRead.ts';
import { backupLiveRadioSession } from '../../services/radioBackupRestore.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildRadioBackupPage from './BuildRadioBackupPage.tsx';

const WARNING =
  "This backup contains the radio's Brandmeister AirSecurity seed. Keep the file safe: anyone with it can authorise your DMR ID. Clearing the seed later does not remove it from this file.";

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: () => true,
    openRadioSessionForEgress: vi.fn(async () => ({ session: { radio: {}, descriptor: {} } })),
    closeRadioSession: vi.fn(async () => {}),
  };
});

vi.mock('../../services/radioBackupRestore.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioBackupRestore.ts')>();
  return {
    ...actual,
    backupLiveRadioSession: vi.fn(),
  };
});

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

function imageHolding(record: Uint8Array): MemoryMap {
  const start = AIRSECURITY_SEED_ADDRESS;
  return {
    size: start + record.length,
    bytes: new Uint8Array(0),
    get(offset, length) {
      if (offset === start && length === record.length) return record.slice();
      return new Uint8Array(length);
    },
    set() {
      return undefined;
    },
    fill() {
      return undefined;
    },
  };
}

function sessionWith(record: Uint8Array): RadioBackupSession {
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-11-24T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'AT-D890UV',
    descriptorLabel: 'Anytone AT-D890UV',
    coverage: 'known-map-regions',
    imageByteLength: AIRSECURITY_SEED_ADDRESS + AIRSECURITY_SEED_RECORD_LENGTH,
    regions: [
      {
        id: 'settings-store',
        label: 'Settings store (MM9PDY)',
        address: D890_MAP.SettingsStore,
        byteLength: D890_MAP.SettingsStoreLength,
        path: 'regions/settings-store.bin',
        restoreRole: 'restorable',
      },
    ],
  };
  return {
    source: 'live-read',
    manifest,
    image: imageHolding(record),
    zipBytes: new Uint8Array(),
  };
}

function renderPage() {
  const { build, egress, egressPaths } = newRadioBuildForProfile(
    'project-1',
    'radio-io-at-d890uv-mm9pdy',
  );
  render(
    <MemoryRouter>
      <BuildLayoutProvider
        value={{
          build,
          buildId: build.id,
          egressPaths,
          activeEgress: egress,
          setActiveEgressId: vi.fn(),
          reloadEgressPaths: vi.fn(async () => {}),
        }}
      >
        <DesignSystemV2Provider>
          <BuildRadioBackupPage />
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
}

async function openBackup(record: Uint8Array) {
  vi.mocked(backupLiveRadioSession).mockResolvedValue(sessionWith(record));
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Backup radio' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save zip again' })).toBeInTheDocument(),
  );
}

describe('BuildRadioBackupPage AirSecurity warning', () => {
  it('warns when the settings-store record is a seed, and does not show the bytes', async () => {
    const record = encodeAirSecuritySeedRecord(new TextEncoder().encode('12345678901234567890'));
    await openBackup(record);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('12345678901234567890');
  });

  it('stays quiet when the settings-store record is 32 zero bytes', async () => {
    await openBackup(new Uint8Array(32));
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});
