import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { CpsPreviewResult } from '../../services/buildCpsExportService.ts';
import { BuildLayoutProvider } from '../../routes/builds/BuildLayoutContext.tsx';
import ExportBuildCpsPanel from './ExportBuildCpsPanel.tsx';

const {
  downloadCpsZip,
  downloadCpsFile,
  downloadCpsSingleFile,
  previewCpsExport,
  previewCpsSingleFile,
  listCpsExportFileNames,
} = vi.hoisted(() => ({
  downloadCpsZip: vi.fn(async () => ({ warnings: [] as string[] })),
  downloadCpsFile: vi.fn(async () => ({ warnings: [] as string[] })),
  downloadCpsSingleFile: vi.fn(async () => ({ warnings: [] as string[] })),
  previewCpsExport: vi.fn(async (): Promise<CpsPreviewResult> => ({
    files: {
      'Channels.csv': 'Name,RxFrequency\nTestCh,145.00000',
      'Zones.csv': 'Name,Channels\nZone1,TestCh',
    },
    warnings: [],
    fileNames: ['Channels.csv', 'Zones.csv'],
  })),
  previewCpsSingleFile: vi.fn(async (): Promise<CpsPreviewResult> => ({
    files: {
      'Baofeng_UV-5R Mini_export.csv': 'Location,Name,Frequency\n0,TestCh,145.00000',
    },
    warnings: [],
    fileNames: ['Baofeng_UV-5R Mini_export.csv'],
  })),
  listCpsExportFileNames: vi.fn(async () => ['Channels.csv', 'Zones.csv']),
}));

vi.mock('../../services/buildCpsExportService.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/buildCpsExportService.ts')>();
  return {
    ...actual,
    // Keep real defaultCpsSingleFileName so poisoned CHIRP profile ids still throw in tests.
    defaultCpsZipFileName: () => 'demo-opengd77.zip',
    downloadCpsFile,
    downloadCpsSingleFile,
    downloadCpsZip,
    previewCpsExport,
    previewCpsSingleFile,
    listCpsExportFileNames,
    uploadCpsZipToDrive: vi.fn(),
  };
});

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({
    modalOpen: false,
    stay: vi.fn(),
    leave: vi.fn(),
  }),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProjectId: 'project-1',
    activeProject: { name: 'Demo', interchange: {} },
  }),
}));

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => ({
    connected: true,
    isConfigured: true,
    sessionExpired: false,
    withDriveAuthRetry: <T,>(operation: () => Promise<T>) => operation(),
  }),
}));

vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({
    putBuild: vi.fn(async () => ({ ok: true as const, revision: 2 })),
  }),
}));

vi.mock('../../state/persistence.ts', () => ({
  persistence: {
    listChannels: vi.fn(async () => [{ id: 'ch-1' }]),
    listAprsConfigurations: vi.fn(async () => []),
    putEgressPath: vi.fn(async () => ({ ok: true as const, revision: 2 })),
  },
}));

vi.mock('../import-export/DriveBrowserModal.tsx', () => ({
  default: () => null,
}));

function renderExportPanel(
  profileId: string,
  opts?: { hydration?: EgressPath['hydration']; router?: boolean },
) {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', profileId);
  if (opts?.hydration) {
    egress.hydration = opts.hydration;
  }
  const layoutValue = {
    build,
    buildId: build.id,
    egressPaths,
    activeEgress: egress,
    setActiveEgressId: vi.fn(),
    reloadEgressPaths: vi.fn(async () => {}),
  };
  const panel = (
    <BuildLayoutProvider value={layoutValue}>
      <MantineProvider>
        <ExportBuildCpsPanel build={build} />
      </MantineProvider>
    </BuildLayoutProvider>
  );
  if (opts?.router) {
    return render(<MemoryRouter>{panel}</MemoryRouter>);
  }
  return render(panel);
}

describe('ExportBuildCpsPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('renders export name settings for shipped OpenGD77 builds', async () => {
    renderExportPanel('opengd77-1701');

    expect(await screen.findByText('Naming')).toBeInTheDocument();
    expect(screen.getByText('Shorten long names')).toBeInTheDocument();
    expect(screen.getByText('Default scan behaviour')).toBeInTheDocument();
  });

  it('renders download ZIP and per-file export actions for shipped OpenGD77 builds', async () => {
    renderExportPanel('opengd77-1701');

    expect(await screen.findByText(/OpenGD77 \(1701\)/)).toBeInTheDocument();
    const zipButton = await screen.findByRole('button', { name: 'Download ZIP' });
    expect(zipButton).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save ZIP to Drive' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Channels.csv' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zones.csv' })).not.toBeDisabled();
  });

  it('renders CHIRP single-file export actions for shipped CHIRP builds', async () => {
    renderExportPanel('chirp-uv5r', { router: true });

    expect(await screen.findByRole('button', { name: 'Download CSV' })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Download ZIP' })).not.toBeInTheDocument();
    expect(screen.queryByText(/not in the memory list/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aren't in a zone/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Only analogue FM\/AM channels/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/FYI: there's another pathway for UV-5R Mini in the browser/),
    ).not.toBeInTheDocument();
  });

  it('does not show CHIRP try-NeonPlug tip on UV-5R Mini CHIRP pathway', async () => {
    renderExportPanel('chirp-uv5r', { router: true });

    expect(await screen.findByRole('button', { name: 'Download CSV' })).not.toBeDisabled();
    expect(
      screen.queryByText(/FYI: there's another pathway for UV-5R Mini in the browser/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Prefer NeonPlug to write your DM-32/)).not.toBeInTheDocument();
  });

  it('shows prefer-NeonPlug deprecation alert for DM32 CSV pathway only', async () => {
    const { unmount } = renderExportPanel('dm32-baofeng-dm32uv', { router: true });

    expect(await screen.findByText(/Prefer NeonPlug to write your DM-32/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download ZIP' })).not.toBeDisabled();
    unmount();

    renderExportPanel('opengd77-1701');
    expect(await screen.findByText(/OpenGD77 \(1701\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Prefer NeonPlug to write your DM-32/)).not.toBeInTheDocument();
  });

  it('places radio settings above the export pathway switcher', async () => {
    const { build, egressPaths } = newRadioBuildForProfile('project-1', 'radio-io-uv5r-mini');
    const radioIo = egressPaths.find((path) => path.formatId === 'radio-io');
    if (!radioIo) throw new Error('expected Web Serial egress');

    render(
      <BuildLayoutProvider
        value={{
          build,
          buildId: build.id,
          egressPaths,
          activeEgress: radioIo,
          setActiveEgressId: vi.fn(),
          reloadEgressPaths: vi.fn(async () => {}),
        }}
      >
        <MantineProvider>
          <MemoryRouter>
            <ExportBuildCpsPanel build={build} />
          </MemoryRouter>
        </MantineProvider>
      </BuildLayoutProvider>,
    );

    const naming = await screen.findByText('Naming');
    const pathway = screen.getByText('Export pathway');
    expect(naming.compareDocumentPosition(pathway) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens CSV preview modal for CHIRP single-file export', async () => {
    renderExportPanel('chirp-uv5r', { router: true });

    const previewButton = await screen.findByRole('button', { name: 'Preview CSV' });
    fireEvent.click(previewButton);

    expect(await screen.findByRole('dialog', { name: 'CSV preview' })).toBeInTheDocument();
    await waitFor(() => {
      expect(previewCpsSingleFile).toHaveBeenCalled();
    });
    expect(await screen.findByRole('cell', { name: 'TestCh' })).toBeInTheDocument();
  });

  it('hides default scan behaviour for Anytone dedicated scan list builds', async () => {
    renderExportPanel('anytone-at-d890uv');

    expect(await screen.findByText('Scan lists')).toBeInTheDocument();
    expect(screen.queryByText('Default scan behaviour')).not.toBeInTheDocument();
    expect(screen.getByText(/Library → Scan lists/i)).toBeInTheDocument();
    expect(screen.getByText(/Export zone-derived scan lists/i)).toBeInTheDocument();
  });

  it('opens CSV preview modal with per-file tabs after Preview CSV', async () => {
    renderExportPanel('opengd77-1701');

    const previewButton = await screen.findByRole('button', { name: 'Preview CSV' });
    expect(previewButton).not.toBeDisabled();
    fireEvent.click(previewButton);

    expect(await screen.findByRole('dialog', { name: 'CSV preview' })).toBeInTheDocument();
    await waitFor(() => {
      expect(previewCpsExport).toHaveBeenCalled();
    });
    expect(await screen.findByRole('tab', { name: /Channels\.csv/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Zones\.csv/ })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'TestCh' })).toBeInTheDocument();
  });

  it('shows conditional Anytone receive-bank files in individual download buttons', async () => {
    listCpsExportFileNames.mockResolvedValueOnce([
      'Channel.CSV',
      'DMRZone.CSV',
      'ScanList.CSV',
      'DMRTalkGroups.CSV',
      'DMRDigitalContactList.CSV',
      'DMRReceiveGroupCallList.CSV',
      'AMAir.CSV',
    ]);
    previewCpsExport.mockResolvedValueOnce({
      files: {
        'Channel.CSV': '"No.","Channel Name"\n"1","DMR 1"',
        'AMAir.CSV': '"No.","Frequency[MHz]","Name"\n"1","118.8000","Tower"',
      },
      warnings: [],
      fileNames: ['Channel.CSV', 'AMAir.CSV'],
    });

    renderExportPanel('anytone-at-d890uv');

    expect(await screen.findByRole('button', { name: 'AMAir.CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Channel.CSV' })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Preview CSV' }));
    expect(await screen.findByRole('dialog', { name: 'CSV preview' })).toBeInTheDocument();
    await waitFor(() => {
      expect(previewCpsExport).toHaveBeenCalled();
    });
    expect(await screen.findByRole('tab', { name: /AMAir\.CSV/ })).toBeInTheDocument();
  });

  it('shows conditional AMZone.CSV in individual download buttons and preview', async () => {
    listCpsExportFileNames.mockResolvedValueOnce([
      'Channel.CSV',
      'DMRZone.CSV',
      'ScanList.CSV',
      'DMRTalkGroups.CSV',
      'DMRDigitalContactList.CSV',
      'DMRReceiveGroupCallList.CSV',
      'AMAir.CSV',
      'AMZone.CSV',
    ]);
    previewCpsExport.mockResolvedValueOnce({
      files: {
        'AMZone.CSV':
          '"No.","Zone Name","Zone Channel Member","A Channel","Scan Channel "\n"1","AM Zone","Tower","Tower","Tower"',
      },
      warnings: [],
      fileNames: ['AMZone.CSV'],
    });

    renderExportPanel('anytone-at-d890uv');

    expect(await screen.findByRole('button', { name: 'AMZone.CSV' })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Preview CSV' }));
    expect(await screen.findByRole('dialog', { name: 'CSV preview' })).toBeInTheDocument();
    await waitFor(() => {
      expect(previewCpsExport).toHaveBeenCalled();
    });
    expect(await screen.findByRole('tab', { name: /AMZone\.CSV/ })).toBeInTheDocument();
  });

  it('renders NeonPlug merge-first export with greenfield secondary path', async () => {
    renderExportPanel('neonplug-dm32uv');

    expect(await screen.findByText('Merge into radio-read base')).toBeInTheDocument();
    const mergeButton = screen.getByRole('button', { name: 'Download for radio write' });
    expect(mergeButton).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Download greenfield .neonplug' }),
    ).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Preview CSV' })).not.toBeInTheDocument();
    expect(screen.getByText(/not safe to write back/i)).toBeInTheDocument();
    expect(screen.getByText(/saved on this NeonPlug egress pathway/i)).toBeInTheDocument();
  });

  it('enables radio-write download when DM32UV egress has stored hydration', async () => {
    renderExportPanel('neonplug-dm32uv', {
      hydration: {
        formatId: 'neonplug',
        sourceFileName: 'radio.neonplug',
        capturedAt: '2026-07-20T12:00:00.000Z',
        retain: {
          radioIds: [],
          quickContacts: [],
          messages: [],
          digitalEmergencies: [],
          analogEmergencies: [],
          encryptionKeys: [],
          digitalEmergencyConfig: null,
          radioSettings: { powerOnDisplayLine1: 'X' },
          radioInfo: { model: 'DP570UV' },
        },
      },
    });

    expect(
      await screen.findByRole('button', { name: 'Download for radio write' }),
    ).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear stored donor' })).toBeInTheDocument();
    expect(screen.getByText(/Stored: radio\.neonplug/)).toBeInTheDocument();
  });

  it('persists donor settings messaging for UV5R-Mini NeonPlug builds', async () => {
    renderExportPanel('neonplug-uv5rmini');

    expect(await screen.findByText('Merge into radio-read base')).toBeInTheDocument();
    expect(screen.getByText(/saved on this NeonPlug egress pathway/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download for radio write' })).toBeDisabled();
  });

  it('enables radio-write download when UV5R-Mini egress has stored hydration', async () => {
    renderExportPanel('neonplug-uv5rmini', {
      hydration: {
        formatId: 'neonplug',
        sourceFileName: 'uv5r.neonplug',
        capturedAt: '2026-07-21T12:00:00.000Z',
        retain: {
          radioIds: [],
          quickContacts: [],
          messages: [],
          digitalEmergencies: [],
          analogEmergencies: [],
          encryptionKeys: [],
          digitalEmergencyConfig: null,
          radioSettings: { radioSpecific: { foo: 1 } },
          radioInfo: { model: 'UV5R-Mini' },
        },
      },
    });

    expect(
      await screen.findByRole('button', { name: 'Download for radio write' }),
    ).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear stored donor' })).toBeInTheDocument();
    expect(screen.getByText(/Stored: uv5r\.neonplug/)).toBeInTheDocument();
  });

  it('shows Web Serial panel for Direct radio builds without CPS download', async () => {
    renderExportPanel('radio-io-uv5r-mini');

    expect(await screen.findByText(/Direct radio via Web Serial/i)).toBeInTheDocument();
    expect(screen.getByText(/no CPS file export/i)).toBeInTheDocument();
    expect(screen.getByText('Naming')).toBeInTheDocument();
    expect(screen.getByText(/Target name length/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download ZIP/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download CSV/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Read from radio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Write to radio/i })).toBeInTheDocument();
  });

  it('shows empty state when no active egress pathway', () => {
    const { build } = newRadioBuildForProfile('project-1', 'opengd77-1701');
    render(
      <BuildLayoutProvider
        value={{
          build,
          buildId: build.id,
          egressPaths: [],
          activeEgress: null,
          setActiveEgressId: vi.fn(),
          reloadEgressPaths: vi.fn(async () => {}),
        }}
      >
        <MantineProvider>
          <ExportBuildCpsPanel build={build} />
        </MantineProvider>
      </BuildLayoutProvider>,
    );

    expect(screen.getByText(/No export pathway/i)).toBeInTheDocument();
  });

  it('survives NeonPlug → CHIRP egress switch without poisoned profile id', async () => {
    const { build, egressPaths } = newRadioBuildForProfile('project-1', 'neonplug-uv5rmini');
    const neon = egressPaths.find((path) => path.formatId === 'neonplug');
    const chirp = egressPaths.find((path) => path.formatId === 'chirp');
    if (!neon || !chirp) throw new Error('expected UV-5R Mini NeonPlug + CHIRP egresses');
    const neonEgress = neon;
    const chirpEgress = chirp;

    function Uv5rMiniExportHarness() {
      const [activeEgressId, setActiveEgressId] = useState(neonEgress.id);
      const activeEgress = egressPaths.find((path) => path.id === activeEgressId) ?? neonEgress;

      return (
        <BuildLayoutProvider
          value={{
            build,
            buildId: build.id,
            egressPaths,
            activeEgress,
            setActiveEgressId,
            reloadEgressPaths: vi.fn(async () => {}),
          }}
        >
          <MantineProvider>
            <MemoryRouter>
              <ExportBuildCpsPanel build={build} />
            </MemoryRouter>
          </MantineProvider>
        </BuildLayoutProvider>
      );
    }

    render(<Uv5rMiniExportHarness />);

    expect(
      await screen.findByRole('button', { name: /Download for radio write/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /CHIRP CSV/i }));
    expect(await screen.findByRole('button', { name: /Download CSV/i })).toBeInTheDocument();
    expect(screen.getByText(/memory CSV using the profile below/i)).toBeInTheDocument();
    expect(chirpEgress.formatId).toBe('chirp');
  });

  it('keeps projection settings visible across UV-5R Mini egress switches', async () => {
    const { build, egressPaths } = newRadioBuildForProfile('project-1', 'radio-io-uv5r-mini');
    const radioIo = egressPaths.find((path) => path.formatId === 'radio-io');
    const neon = egressPaths.find((path) => path.formatId === 'neonplug');
    const chirp = egressPaths.find((path) => path.formatId === 'chirp');
    if (!radioIo || !neon || !chirp) {
      throw new Error('expected UV-5R Mini Web Serial + NeonPlug + CHIRP egresses');
    }

    function Uv5rMiniSettingsHarness() {
      const [activeEgressId, setActiveEgressId] = useState(radioIo.id);
      const activeEgress = egressPaths.find((path) => path.id === activeEgressId) ?? radioIo;

      return (
        <BuildLayoutProvider
          value={{
            build,
            buildId: build.id,
            egressPaths,
            activeEgress,
            setActiveEgressId,
            reloadEgressPaths: vi.fn(async () => {}),
          }}
        >
          <MantineProvider>
            <MemoryRouter>
              <ExportBuildCpsPanel build={build} />
            </MemoryRouter>
          </MantineProvider>
        </BuildLayoutProvider>
      );
    }

    render(<Uv5rMiniSettingsHarness />);

    expect(await screen.findByText('Naming')).toBeInTheDocument();
    expect(screen.getByText('Default scan behaviour')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /NeonPlug/i }));
    expect(await screen.findByText('Naming')).toBeInTheDocument();
    expect(screen.getByText('Default scan behaviour')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /CHIRP CSV/i }));
    expect(await screen.findByText('Naming')).toBeInTheDocument();
    expect(screen.getByText('Default scan behaviour')).toBeInTheDocument();
  });
});
