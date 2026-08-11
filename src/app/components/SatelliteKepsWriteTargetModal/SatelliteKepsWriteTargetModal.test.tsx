import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import SatelliteKepsWriteTargetModal from './SatelliteKepsWriteTargetModal.tsx';

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

// useBlocker requires a data router; these tests only exercise the target list, not
// in-app navigation, so mock the guard the same way ExportBuildCpsPanel.test.tsx does.
vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
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

describe('SatelliteKepsWriteTargetModal — Workflow A target list (#859)', () => {
  it('lists the D890 under "Other supported radios" when the project has no matching build', async () => {
    listRadioBuilds.mockResolvedValueOnce([]);
    listEgressPaths.mockResolvedValueOnce([]);

    renderModal();

    expect(await screen.findByText('Other supported radios')).toBeInTheDocument();
    expect(screen.getByText('Anytone AT-D890UV')).toBeInTheDocument();
    expect(screen.queryByText('Recommended / Your radios')).not.toBeInTheDocument();
  });

  it('lists a build with a capable egress under "Your radios", not duplicated below', async () => {
    const { build, egress } = newRadioBuildForProfile('project-1', 'radio-io-at-d890uv', 'My D890');
    listRadioBuilds.mockResolvedValueOnce([build]);
    listEgressPaths.mockResolvedValueOnce([egress]);

    renderModal();

    expect(await screen.findByText('Recommended / Your radios')).toBeInTheDocument();
    expect(screen.getByText('My D890 — Anytone AT-D890UV')).toBeInTheDocument();
    // Same D890 profile must not also appear generically once it's shown as "Your radios".
    expect(screen.queryByText('Other supported radios')).not.toBeInTheDocument();
  });

  it('does not list a build whose egress profile has no registered keps-write adapter', async () => {
    const { build, egress } = newRadioBuildForProfile(
      'project-1',
      'radio-io-dm32uv',
      'My DM-32',
    );
    listRadioBuilds.mockResolvedValueOnce([build]);
    listEgressPaths.mockResolvedValueOnce([egress]);

    renderModal();

    await waitFor(() => expect(listRadioBuilds).toHaveBeenCalled());
    expect(screen.queryByText(/My DM-32/)).not.toBeInTheDocument();
    // The D890 (unrelated to this build) still shows up as a generic option.
    expect(await screen.findByText('Other supported radios')).toBeInTheDocument();
    expect(screen.getByText('Anytone AT-D890UV')).toBeInTheDocument();
  });
});
