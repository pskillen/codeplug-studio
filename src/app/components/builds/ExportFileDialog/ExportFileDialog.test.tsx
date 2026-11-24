import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import ExportFileDialog from './ExportFileDialog.tsx';

const { checkCpsExport, downloadCpsZip, downloadCpsSingleFile } = vi.hoisted(() => ({
  checkCpsExport: vi.fn(async () => ({
    warnings: [
      {
        kind: 'unlinked',
        severity: 'problem',
        message: 'Including 1 channel(s) not linked to a zone',
      },
    ] as ExportWarning[],
    fileNames: ['Channels.csv', 'Zones.csv'],
  })),
  downloadCpsZip: vi.fn(async () => ({ warnings: [] as ExportWarning[] })),
  downloadCpsSingleFile: vi.fn(async () => ({ warnings: [] as ExportWarning[] })),
}));

vi.mock('../../../services/buildCpsExportService.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/buildCpsExportService.ts')>();
  return {
    ...actual,
    checkCpsExport,
    downloadCpsZip,
    downloadCpsSingleFile,
    downloadCpsFile: vi.fn(async () => ({ warnings: [] })),
    uploadCpsZipToDrive: vi.fn(async () => ({ warnings: [] })),
  };
});

vi.mock('../../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProjectId: 'project-1',
    activeProject: { name: 'Demo', interchange: {} },
  }),
}));

vi.mock('../../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => ({
    withDriveAuthRetry: <T,>(op: () => Promise<T>) => op(),
  }),
}));

vi.mock('../../import-export/DriveBrowserModal.tsx', () => ({
  default: () => null,
}));

function renderDialog(profileId: string, open = true) {
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
          suggestedZipName="demo.zip"
          exportFileNames={['Channels.csv', 'Zones.csv']}
          hasChannels
          reloadEgressPaths={vi.fn(async () => {})}
        />
      </MantineProvider>
    </DesignSystemV2Provider>,
  );
  return { onClose, build, egress };
}

describe('ExportFileDialog', () => {
  beforeEach(() => {
    checkCpsExport.mockClear();
    downloadCpsZip.mockClear();
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
    expect(warnings.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
});
