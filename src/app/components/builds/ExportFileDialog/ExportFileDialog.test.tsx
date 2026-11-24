import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { strToU8, zipSync } from 'fflate';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { DriveSaveTarget } from '../../import-export/DriveBrowserModal.tsx';
import ExportFileDialog from './ExportFileDialog.tsx';

const { checkCpsExport, downloadCpsZip, downloadCpsSingleFile, uploadCpsZipToDrive } = vi.hoisted(
  () => ({
    checkCpsExport: vi.fn(
      async (
        _projectId: string,
        _buildId: string,
        _options?: { baseNeonplugBytes?: Uint8Array },
      ) => ({
        warnings: [
          {
            kind: 'unlinked',
            severity: 'problem',
            message: 'Including 1 channel(s) not linked to a zone',
          },
        ] as ExportWarning[],
        fileNames: ['Channels.csv', 'Zones.csv'],
      }),
    ),
    downloadCpsZip: vi.fn(async () => ({ warnings: [] as ExportWarning[] })),
    downloadCpsSingleFile: vi.fn(async () => ({ warnings: [] as ExportWarning[] })),
    uploadCpsZipToDrive: vi.fn(async () => ({ warnings: [] as ExportWarning[] })),
  }),
);

vi.mock('../../../services/buildCpsExportService.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/buildCpsExportService.ts')>();
  return {
    ...actual,
    checkCpsExport,
    downloadCpsZip,
    downloadCpsSingleFile,
    downloadCpsFile: vi.fn(async () => ({ warnings: [] })),
    uploadCpsZipToDrive,
  };
});

vi.mock('../../../state/persistence.ts', () => ({
  persistence: {
    putEgressPath: vi.fn(async () => ({ ok: true as const, revision: 2 })),
  },
}));

vi.mock('../../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProjectId: 'project-1',
    activeProject: { name: 'Demo', interchange: {} },
  }),
}));

vi.mock('../../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => ({
    connected: true,
    isConfigured: true,
    sessionExpired: false,
    withDriveAuthRetry: <T,>(op: () => Promise<T>) => op(),
  }),
}));

vi.mock('../../import-export/DriveBrowserModal.tsx', () => ({
  default: ({
    opened,
    onSaveTarget,
  }: {
    opened: boolean;
    onSaveTarget: (target: DriveSaveTarget) => void;
  }) =>
    opened ? (
      <button
        type="button"
        data-testid="drive-browser-mock-save"
        onClick={() =>
          onSaveTarget({
            folderId: 'folder-1',
            folderName: 'Interchange',
            fileName: 'demo-opengd77.zip',
            path: [{ id: 'folder-1', name: 'Interchange' }],
            existingFileId: 'file-existing',
          })
        }
      >
        Mock Drive save
      </button>
    ) : null,
}));

function renderDialog(profileId: string, open = true, opts?: { interchangeFolderId?: string }) {
  const { build, egress } = newRadioBuildForProfile('project-1', profileId);
  const onClose = vi.fn();
  render(
    <DesignSystemV2Provider>
      <MantineProvider>
        <ExportFileDialog
          open={open}
          onClose={onClose}
          build={build}
          projectId="project-1"
          activeEgress={egress}
          formatId={egress.formatId as 'opengd77'}
          formatLabel="OpenGD77 CSV"
          buildProfileId={profileId}
          exportProfileId={profileId}
          onExportProfileIdChange={vi.fn()}
          runtimeExportOverrides={{ egressId: egress.id }}
          suggestedZipName="demo-opengd77.zip"
          exportFileNames={['Channels.csv', 'Zones.csv']}
          hasChannels
          interchangeFolderId={opts?.interchangeFolderId}
          reloadEgressPaths={vi.fn(async () => {})}
        />
      </MantineProvider>
    </DesignSystemV2Provider>,
  );
  return { onClose, build, egress };
}

function minimalNeonplugJson(model: string): string {
  return JSON.stringify({
    version: '1.0.0',
    exportDate: '2026-01-01T00:00:00.000Z',
    channels: [],
    zones: [],
    scanLists: [],
    contacts: [],
    rxGroups: [],
    radioIds: [],
    quickContacts: [],
    messages: [],
    digitalEmergencies: [],
    analogEmergencies: [],
    encryptionKeys: [],
    digitalEmergencyConfig: null,
    radioSettings: null,
    radioInfo: { model, firmware: '', buildDate: '', vframes: {} },
  });
}

function neonplugDonorFile(model: string): File {
  const zip = zipSync({ 'codeplug.json': strToU8(minimalNeonplugJson(model)) });
  return new File([zip], 'donor.neonplug', { type: 'application/zip' });
}

function renderNeonplugDialog(opts?: {
  hydration?: EgressPath['hydration'];
  interchangeFolderId?: string;
}) {
  const profileId = 'neonplug-dm32uv';
  const { build, egress } = newRadioBuildForProfile('project-1', profileId);
  if (opts?.hydration) {
    egress.hydration = opts.hydration;
  }
  const onClose = vi.fn();
  render(
    <DesignSystemV2Provider>
      <MantineProvider>
        <ExportFileDialog
          open
          onClose={onClose}
          build={build}
          projectId="project-1"
          activeEgress={egress}
          formatId="neonplug"
          formatLabel="NeonPlug"
          buildProfileId={profileId}
          exportProfileId={profileId}
          onExportProfileIdChange={vi.fn()}
          runtimeExportOverrides={{ egressId: egress.id }}
          suggestedZipName="demo.neonplug"
          exportFileNames={['codeplug.json']}
          hasChannels
          interchangeFolderId={opts?.interchangeFolderId}
          reloadEgressPaths={vi.fn(async () => {})}
        />
      </MantineProvider>
    </DesignSystemV2Provider>,
  );
  return { onClose, build, egress, profileId };
}

const storedNeonplugHydration: EgressPath['hydration'] = {
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
};

describe('ExportFileDialog', () => {
  beforeEach(() => {
    checkCpsExport.mockClear();
    downloadCpsZip.mockClear();
    uploadCpsZipToDrive.mockClear();
  });

  it('opens on Checks when the format has no choice', async () => {
    renderDialog('opengd77-1701');
    expect(await screen.findByTestId('egress-step-label')).toHaveTextContent(/Checks/);
    expect(checkCpsExport).toHaveBeenCalled();
    expect(screen.getByTestId('export-warnings-full')).toBeInTheDocument();
  });

  it('CHIRP opens on What to export and re-checks when the profile changes', async () => {
    const { egress } = newRadioBuildForProfile('project-1', 'chirp-uv5r');
    const onProfile = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <MantineProvider>
          <ExportFileDialog
            open
            onClose={vi.fn()}
            build={newRadioBuildForProfile('project-1', 'chirp-uv5r').build}
            projectId="project-1"
            activeEgress={egress}
            formatId="chirp"
            formatLabel="CHIRP CSV"
            buildProfileId="chirp-uv5r"
            exportProfileId="chirp-uv5r"
            onExportProfileIdChange={onProfile}
            runtimeExportOverrides={{ egressId: egress.id }}
            suggestedZipName="chirp.csv"
            exportFileNames={['out.csv']}
            hasChannels
            reloadEgressPaths={vi.fn(async () => {})}
          />
        </MantineProvider>
      </DesignSystemV2Provider>,
    );
    expect(await screen.findByTestId('egress-step-label')).toHaveTextContent(/What to export/);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkCpsExport).toHaveBeenCalled());
    checkCpsExport.mockClear();
    rerender(
      <DesignSystemV2Provider>
        <MantineProvider>
          <ExportFileDialog
            open
            onClose={vi.fn()}
            build={newRadioBuildForProfile('project-1', 'chirp-uv5r').build}
            projectId="project-1"
            activeEgress={egress}
            formatId="chirp"
            formatLabel="CHIRP CSV"
            buildProfileId="chirp-uv5r"
            exportProfileId="chirp-bf888"
            onExportProfileIdChange={onProfile}
            runtimeExportOverrides={{ egressId: egress.id, profileId: 'chirp-bf888' }}
            suggestedZipName="chirp.csv"
            exportFileNames={['out.csv']}
            hasChannels
            reloadEgressPaths={vi.fn(async () => {})}
          />
        </MantineProvider>
      </DesignSystemV2Provider>,
    );
    await waitFor(() => expect(checkCpsExport).toHaveBeenCalled());
  });

  it('lists problems before the download button', async () => {
    renderDialog('opengd77-1701');
    const warnings = await screen.findByTestId('export-warnings-full');
    expect(screen.getByText(/not linked to a zone/)).toBeInTheDocument();
    const download = screen.getByTestId('export-download-zip');
    expect(
      warnings.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Download goes to the done step with a recap', async () => {
    renderDialog('opengd77-1701');
    await screen.findByTestId('export-download-zip');
    fireEvent.click(screen.getByTestId('export-download-zip'));
    await waitFor(() => expect(screen.getByTestId('export-done-step')).toBeInTheDocument());
    expect(screen.getByTestId('export-warnings-recap')).toBeInTheDocument();
  });

  it('warnings do not accumulate across two opens', async () => {
    renderDialog('opengd77-1701');
    await screen.findByText(/not linked to a zone/);
    cleanup();
    checkCpsExport.mockResolvedValueOnce({
      warnings: [{ kind: 'general', severity: 'problem', message: 'Only once' }],
      fileNames: ['Channels.csv'],
    });
    renderDialog('opengd77-1701');
    await waitFor(() => expect(screen.getByText('Only once')).toBeInTheDocument());
    expect(screen.queryByText(/not linked to a zone/)).not.toBeInTheDocument();
  });

  it('NeonPlug opens on What to export with the stored donor chosen', async () => {
    renderNeonplugDialog({ hydration: storedNeonplugHydration });
    expect(await screen.findByTestId('egress-step-label')).toHaveTextContent(/What to export/);
    expect(await screen.findByText(/radio\.neonplug/)).toBeInTheDocument();
    const useStored = screen.getByRole('button', { name: 'Use stored donor' });
    expect(useStored).toHaveAttribute('data-variant', 'filled');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkCpsExport).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', { name: 'Download for radio write' }),
    ).not.toBeDisabled();
  });

  it('donor validation warnings appear on Checks', async () => {
    renderNeonplugDialog();
    const mismatchModel = 'UV5R-Mini';
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [neonplugDonorFile(mismatchModel)] } });
    await waitFor(() => expect(screen.getByText(/donor\.neonplug/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkCpsExport).toHaveBeenCalled());
    expect(
      await screen.findByText(new RegExp(`Donor radioInfo.model is "${mismatchModel}"`)),
    ).toBeInTheDocument();
    const lastOptions = checkCpsExport.mock.calls.at(-1)?.[2];
    expect(lastOptions?.baseNeonplugBytes).toBeInstanceOf(Uint8Array);
  });

  it('greenfield export shows the no-donor warning', async () => {
    renderNeonplugDialog();
    expect(await screen.findByTestId('egress-step-label')).toHaveTextContent(/What to export/);
    expect(
      screen.getByRole('button', { name: 'Export without a donor (greenfield)' }),
    ).toHaveAttribute('data-variant', 'filled');
    expect(screen.getByText(/Greenfield download \(not for radio write\)/)).toBeInTheDocument();
    expect(screen.getByText(/not safe to write back/i)).toBeInTheDocument();
  });

  it('Save to Drive is a delivery on Checks and asks before overwriting', async () => {
    renderDialog('opengd77-1701', true, { interchangeFolderId: 'drive-folder-1' });
    await screen.findByTestId('export-download-zip');
    const saveDrive = await screen.findByRole('button', { name: 'Save ZIP to Drive' });
    expect(saveDrive).toBeInTheDocument();
    fireEvent.click(saveDrive);
    fireEvent.click(await screen.findByTestId('drive-browser-mock-save'));
    expect(await screen.findByText(/Overwrite file\?/)).toBeInTheDocument();
    expect(uploadCpsZipToDrive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite' }));
    await waitFor(() => expect(uploadCpsZipToDrive).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('export-done-step')).toBeInTheDocument();
    expect(screen.getByText(/Saved demo-opengd77\.zip to Drive/)).toBeInTheDocument();
  });
});
