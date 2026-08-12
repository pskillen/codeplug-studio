import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { BuildLayoutProvider } from '../../routes/builds/BuildLayoutContext.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';

/**
 * #1085 promoted the inline "Write Keps" button + collapsible preview panel to a dedicated
 * `/builds/:id/satellite-keps` tab (`BuildSatelliteKepsPage.test.tsx` covers that page's
 * behaviour — the busy/disable interaction, capacity pre-flight, and preview table). What's left
 * here is just: does this panel show a "Write Keps…" *link* to that tab when the egress profile
 * has a registered adapter, and not otherwise.
 */

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: () => true,
    getRadioSerialUnsupportedMessage: () => 'Web Serial not supported.',
    openRadioSessionForEgress: vi.fn(() => new Promise(() => {})),
    closeRadioSession: vi.fn(async () => {}),
  };
});

vi.mock('../../services/satelliteKepsWriteAdapters.ts', () => ({
  hasSatelliteKepsWriteAdapter: (profileId: string) => profileId === 'radio-io-at-d890uv',
}));

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'project-1', activeProject: { name: 'Demo' } }),
}));

vi.mock('../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => []),
    subscribe: vi.fn(() => () => {}),
  },
}));

function renderPanel(profileId: string) {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', profileId);
  const layoutValue = {
    build,
    buildId: build.id,
    egressPaths,
    activeEgress: egress,
    setActiveEgressId: vi.fn(),
    reloadEgressPaths: vi.fn(async () => {}),
  };
  const result = render(
    <MemoryRouter>
      <BuildLayoutProvider value={layoutValue}>
        <MantineProvider>
          <BuildRadioIoPanel build={build} egress={egress} />
        </MantineProvider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
  return { ...result, build };
}

describe('BuildRadioIoPanel — Write Keps link (#1085)', () => {
  it('renders a "Write Keps…" link to the Satellite Keps tab for a profile with a registered adapter', () => {
    const { build } = renderPanel('radio-io-at-d890uv');
    const link = screen.getByRole('link', { name: 'Write Keps…' });
    expect(link).toHaveAttribute('href', `/builds/${build.id}/satellite-keps`);
  });

  it('does not render a Write Keps link for a profile with no registered adapter', () => {
    renderPanel('neonplug-dm32uv');
    expect(screen.queryByRole('link', { name: 'Write Keps…' })).not.toBeInTheDocument();
  });
});
