import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import SatelliteKepsWriteTargetModal from './SatelliteKepsWriteTargetModal.tsx';

const writeDialogState = vi.hoisted(() => ({
  open: vi.fn(),
}));

const { listRadioBuilds, listEgressPaths } = vi.hoisted(() => ({
  listRadioBuilds: vi.fn(async (): Promise<RadioBuild[]> => []),
  listEgressPaths: vi.fn(async (): Promise<EgressPath[]> => []),
}));

vi.mock('../../state/persistence.ts', () => ({
  persistence: {
    listRadioBuilds,
    listEgressPaths,
    listSatellites: vi.fn(async () => []),
  },
}));

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: () => true,
    descriptorsForEgress: actual.descriptorsForEgress,
  };
});

vi.mock('../builds/RadioWriteDialog/useRadioWriteDialog.tsx', () => ({
  useRadioWriteDialog: () => ({
    element: null,
    open: writeDialogState.open,
    busy: false,
  }),
}));

function renderModal(projectId = 'project-1') {
  return render(
    <MantineProvider>
      <DesignSystemV2Provider>
        <SatelliteKepsWriteTargetModal opened onClose={vi.fn()} projectId={projectId} />
      </DesignSystemV2Provider>
    </MantineProvider>,
  );
}

describe('SatelliteKepsWriteTargetModal — Workflow A', () => {
  it('the library picker lists only builds with a keps adapter', async () => {
    const { build: d890, egress: d890Egress } = newRadioBuildForProfile(
      'project-1',
      'radio-io-at-d890uv',
      'My D890',
    );
    const { build: dm32, egress: dm32Egress } = newRadioBuildForProfile(
      'project-1',
      'radio-io-dm32uv',
      'My DM-32',
    );
    listRadioBuilds.mockResolvedValueOnce([d890, dm32]);
    listEgressPaths.mockResolvedValueOnce([d890Egress, dm32Egress]);

    renderModal();

    await waitFor(() => expect(screen.getByText('My D890 — Anytone AT-D890UV')).toBeInTheDocument());
    expect(screen.queryByText(/My DM-32/)).not.toBeInTheDocument();
    expect(screen.queryByText('Other supported radios')).not.toBeInTheDocument();
  });

  it('choosing a build opens its Write dialog with only keps ticked', async () => {
    const { build, egress } = newRadioBuildForProfile(
      'project-1',
      'radio-io-at-d890uv',
      'My D890',
    );
    listRadioBuilds.mockResolvedValueOnce([build]);
    listEgressPaths.mockResolvedValueOnce([egress]);

    renderModal();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(writeDialogState.open).toHaveBeenCalledWith({
        codeplug: false,
        contacts: false,
        settings: false,
        keps: true,
      }),
    );
  });

  it('shows the empty state when no build can write keps', async () => {
    listRadioBuilds.mockResolvedValueOnce([]);
    listEgressPaths.mockResolvedValueOnce([]);

    renderModal();

    expect(
      await screen.findByText(/No build can write satellite keps yet/),
    ).toBeInTheDocument();
  });
});