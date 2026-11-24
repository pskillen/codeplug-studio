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

const fileOpen = vi.hoisted(() => ({
  current: null as unknown,
}));

vi.mock('../../services/radioBackupRestore.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioBackupRestore.ts')>();
  return {
    ...actual,
    backupLiveRadioSession: vi.fn(),
    openRadioBackupZip: vi.fn(() => {
      if (fileOpen.current === null) throw new Error('no opened backup');
      return fileOpen.current;
    }),
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

const SETTINGS_STORE_REGION: RadioBackupManifestV1['regions'][number] = {
  id: 'settings-store',
  label: 'Settings store (MM9PDY)',
  address: D890_MAP.SettingsStore,
  byteLength: D890_MAP.SettingsStoreLength,
  path: 'regions/settings-store.bin',
  restoreRole: 'restorable',
};

function sessionWith(
  record: Uint8Array,
  overrides?: {
    source?: RadioBackupSession['source'];
    radioModelId?: string;
    regions?: RadioBackupManifestV1['regions'];
  },
): RadioBackupSession {
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-11-24T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: overrides?.radioModelId ?? 'AT-D890UV',
    descriptorLabel: 'Anytone AT-D890UV',
    coverage: 'known-map-regions',
    imageByteLength: AIRSECURITY_SEED_ADDRESS + AIRSECURITY_SEED_RECORD_LENGTH,
    regions: overrides?.regions ?? [SETTINGS_STORE_REGION],
  };
  return {
    source: overrides?.source ?? 'live-read',
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
  return render(
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

async function openBackup(record: Uint8Array, overrides?: Parameters<typeof sessionWith>[1]) {
  vi.mocked(backupLiveRadioSession).mockResolvedValue(sessionWith(record, overrides));
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Backup radio' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save zip again' })).toBeInTheDocument(),
  );
}

async function openBackupFile(record: Uint8Array) {
  fileOpen.current = sessionWith(record, { source: 'file' });
  const view = renderPage();
  const input = [...view.container.querySelectorAll('input[type="file"]')].at(-1);
  if (!(input instanceof HTMLInputElement)) throw new Error('backup file input missing');
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array([1])], 'seed.zip', { type: 'application/zip' })] },
  });
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

  it('stays quiet for a non-D890 backup that holds a seed record at the seed address', async () => {
    const record = encodeAirSecuritySeedRecord(new TextEncoder().encode('12345678901234567890'));
    await openBackup(record, { radioModelId: 'DM-32UV' });
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('stays quiet for a D890 backup whose manifest has no settings-store region', async () => {
    const record = encodeAirSecuritySeedRecord(new TextEncoder().encode('12345678901234567890'));
    await openBackup(record, {
      regions: [
        {
          id: 'local-info',
          label: 'Local info',
          address: 0x04f80000,
          byteLength: 0x100,
          path: 'regions/local-info.bin',
          restoreRole: 'inspect-only',
        },
      ],
    });
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('warns when an opened backup file holds the seed', async () => {
    const record = encodeAirSecuritySeedRecord(new TextEncoder().encode('12345678901234567890'));
    await openBackupFile(record);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('12345678901234567890');
  });
});
