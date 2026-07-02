import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ExportToDrivePanel from './ExportToDrivePanel.tsx';

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProjectId: 'project-1',
    activeProject: { name: 'Demo', interchange: {} },
    refreshProjects: vi.fn(),
  }),
}));

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => ({
    connected: true,
    isConfigured: true,
  }),
}));

vi.mock('./DriveBrowserModal.tsx', () => ({
  default: () => null,
}));

describe('ExportToDrivePanel', () => {
  it('renders save to drive action', () => {
    render(
      <MantineProvider>
        <ExportToDrivePanel />
      </MantineProvider>,
    );
    expect(screen.getByRole('button', { name: 'Save to Drive' })).toBeInTheDocument();
  });
});
