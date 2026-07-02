import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import ExportBuildCpsPanel from './ExportBuildCpsPanel.tsx';

const { downloadCpsZip, downloadCpsFile } = vi.hoisted(() => ({
  downloadCpsZip: vi.fn(async () => ({ warnings: [] as string[] })),
  downloadCpsFile: vi.fn(async () => ({ warnings: [] as string[] })),
}));

vi.mock('../../services/buildCpsExportService.ts', () => ({
  defaultCpsZipFileName: () => 'demo-opengd77.zip',
  downloadCpsFile,
  downloadCpsZip,
  uploadCpsZipToDrive: vi.fn(),
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
  }),
}));

vi.mock('../../state/persistence.ts', () => ({
  persistence: {
    listChannels: vi.fn(async () => [{ id: 'ch-1' }]),
  },
}));

vi.mock('../import-export/DriveBrowserModal.tsx', () => ({
  default: () => null,
}));

const opengd77Build: FormatBuild = {
  id: 'build-1',
  projectId: 'project-1',
  name: 'OpenGD77 1701',
  formatId: 'opengd77',
  profileId: 'opengd77-1701',
  revision: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  channelOverrides: [],
  zoneOverrides: [],
  contactOverrides: [],
  talkGroupOverrides: [],
  rxGroupListOverrides: [],
  layout: { sections: [] },
};

describe('ExportBuildCpsPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('renders export name settings for shipped OpenGD77 builds', async () => {
    render(
      <MantineProvider>
        <ExportBuildCpsPanel build={opengd77Build} />
      </MantineProvider>,
    );

    expect(await screen.findByText('Export name settings')).toBeInTheDocument();
    expect(screen.getByText('Shorten long channel names')).toBeInTheDocument();
  });

  it('renders download ZIP and per-file export actions for shipped OpenGD77 builds', async () => {
    render(
      <MantineProvider>
        <ExportBuildCpsPanel build={opengd77Build} />
      </MantineProvider>,
    );

    expect(await screen.findByText(/OpenGD77 \(1701\)/)).toBeInTheDocument();
    const zipButton = await screen.findByRole('button', { name: 'Download ZIP' });
    expect(zipButton).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save ZIP to Drive' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Channels.csv' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zones.csv' })).not.toBeDisabled();
  });

  it('shows planned-format alert for non-shipped exporters', () => {
    const chirpBuild: FormatBuild = {
      ...opengd77Build,
      formatId: 'chirp',
      profileId: 'chirp-uv5r',
    };
    render(
      <MantineProvider>
        <ExportBuildCpsPanel build={chirpBuild} />
      </MantineProvider>,
    );

    expect(screen.getByText(/export is planned/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download ZIP' })).not.toBeInTheDocument();
  });
});
