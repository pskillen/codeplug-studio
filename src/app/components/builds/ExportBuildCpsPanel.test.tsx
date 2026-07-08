import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import ExportBuildCpsPanel from './ExportBuildCpsPanel.tsx';

const {
  downloadCpsZip,
  downloadCpsFile,
  downloadCpsSingleFile,
  previewCpsExport,
  previewCpsSingleFile,
} = vi.hoisted(() => ({
  downloadCpsZip: vi.fn(async () => ({ warnings: [] as string[] })),
  downloadCpsFile: vi.fn(async () => ({ warnings: [] as string[] })),
  downloadCpsSingleFile: vi.fn(async () => ({ warnings: [] as string[] })),
  previewCpsExport: vi.fn(async () => ({
    files: {
      'Channels.csv': 'Name,RxFrequency\nTestCh,145.00000',
      'Zones.csv': 'Name,Channels\nZone1,TestCh',
    },
    warnings: [] as string[],
  })),
  previewCpsSingleFile: vi.fn(async () => ({
    files: {
      'Baofeng_UV-5R Mini_export.csv': 'Location,Name,Frequency\n0,TestCh,145.00000',
    },
    warnings: [] as string[],
  })),
}));

vi.mock('../../services/buildCpsExportService.ts', () => ({
  defaultCpsSingleFileName: () => 'Baofeng_UV-5R Mini_export.csv',
  defaultCpsZipFileName: () => 'demo-opengd77.zip',
  downloadCpsFile,
  downloadCpsSingleFile,
  downloadCpsZip,
  previewCpsExport,
  previewCpsSingleFile,
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

vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({
    putBuild: vi.fn(async () => ({ ok: true as const, revision: 2 })),
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
  scanListOverrides: [],
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
    expect(screen.getByText('Default scan behaviour')).toBeInTheDocument();
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

  it('renders CHIRP single-file export actions for shipped CHIRP builds', async () => {
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

    expect(await screen.findByText(/CHIRP CSV/)).toBeInTheDocument();
    const csvButton = await screen.findByRole('button', { name: 'Download CSV' });
    expect(csvButton).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Download ZIP' })).not.toBeInTheDocument();
    expect(screen.getByText(/not in the memory list/i)).toBeInTheDocument();
    expect(screen.getByText(/Only analogue FM\/AM channels/i)).toBeInTheDocument();
  });

  it('opens CSV preview modal for CHIRP single-file export', async () => {
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

    const previewButton = await screen.findByRole('button', { name: 'Preview CSV' });
    fireEvent.click(previewButton);

    expect(await screen.findByRole('dialog', { name: 'CSV preview' })).toBeInTheDocument();
    await waitFor(() => {
      expect(previewCpsSingleFile).toHaveBeenCalled();
    });
    expect(await screen.findByRole('cell', { name: 'TestCh' })).toBeInTheDocument();
  });

  it('hides default scan behaviour for Anytone dedicated scan list builds', async () => {
    const anytoneBuild: FormatBuild = {
      ...opengd77Build,
      formatId: 'anytone',
      profileId: 'anytone-at-d890uv',
    };
    render(
      <MantineProvider>
        <ExportBuildCpsPanel build={anytoneBuild} />
      </MantineProvider>,
    );

    expect(await screen.findByText('Scan export')).toBeInTheDocument();
    expect(screen.queryByText('Default scan behaviour')).not.toBeInTheDocument();
    expect(screen.getByText(/Library → Scan lists/i)).toBeInTheDocument();
  });

  it('opens CSV preview modal with per-file tabs after Preview CSV', async () => {
    render(
      <MantineProvider>
        <ExportBuildCpsPanel build={opengd77Build} />
      </MantineProvider>,
    );

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
});
