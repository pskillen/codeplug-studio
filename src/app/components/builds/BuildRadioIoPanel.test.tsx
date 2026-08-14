import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { BuildLayoutProvider } from '../../routes/builds/BuildLayoutContext.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';

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

vi.mock('../../services/satelliteKepsWriteAdapters.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/satelliteKepsWriteAdapters.ts')>();
  return {
    ...actual,
    hasSatelliteKepsWriteAdapter: (profileId: string) =>
      profileId === 'radio-io-at-d890uv' ||
      profileId === 'radio-io-opengd77-1701' ||
      profileId === 'radio-io-opengd77-md9600',
    getSatelliteKepsWriteAdapter: (profileId: string) =>
      profileId === 'radio-io-at-d890uv' ||
      profileId === 'radio-io-opengd77-1701' ||
      profileId === 'radio-io-opengd77-md9600'
        ? vi.fn()
        : undefined,
  };
});

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'project-1', activeProject: { name: 'Demo' } }),
}));

vi.mock('../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => []),
    countDigitalIdDirectoryEntries: vi.fn(async () => 0),
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
        <DesignSystemV2Provider>
          <BuildRadioIoPanel build={build} egress={egress} />
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
  return { ...result, build };
}

describe('BuildRadioIoPanel — Write radio popup (#1121)', () => {
  it('opens a Write radio popup with keps extra for D890', async () => {
    renderPanel('radio-io-at-d890uv');
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    expect(await screen.findByRole('button', { name: 'Write codeplug' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).toBeInTheDocument();
    expect(screen.queryByText(/digital ID list/i)).not.toBeInTheDocument();
  });

  it('does not show keps extra for a profile with no adapter', async () => {
    renderPanel('radio-io-uv5r-mini');
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    expect(await screen.findByRole('button', { name: 'Write codeplug' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Satellite keps' })).not.toBeInTheDocument();
    expect(screen.queryByText('Digital contacts')).not.toBeInTheDocument();
  });
});

describe('BuildRadioIoPanel — dual-bank / single-bank extras', () => {
  it('shows digital contacts extra for OpenGD77 and defaults None; keps extra is off until checked', async () => {
    renderPanel('radio-io-opengd77-1701');
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    expect(await screen.findByRole('button', { name: 'None' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Write contacts only' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Write keps only' })).toBeDisabled();
  });

  it('shows digital contacts and satellite keps extras for MD-9600', async () => {
    renderPanel('radio-io-opengd77-md9600');
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    expect(await screen.findByText('Digital contacts')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write keps only' })).toBeDisabled();
  });

  it('shows digital contacts extra for AT-D890', async () => {
    renderPanel('radio-io-at-d890uv');
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    expect(await screen.findByText('Digital contacts')).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Codeplug Write projection' }),
    ).not.toBeInTheDocument();
  });

  it('warns when RadioID directory is selected and the shadow is empty', async () => {
    renderPanel('radio-io-opengd77-1701');
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'RadioID' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write codeplug' }));
    expect(await screen.findByText('RadioID directory is empty')).toBeInTheDocument();
  });

  it('does not show digital contacts extra for UV-5R Mini', async () => {
    renderPanel('radio-io-uv5r-mini');
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.queryByText('Digital contacts')).not.toBeInTheDocument();
  });
});

describe('BuildRadioIoPanel — legacy stash migration warning (#879)', () => {
  it('does not show the severe warning for RT95 after drop-stash', () => {
    renderPanel('radio-io-rt95');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for DM-32UV after drop-stash', () => {
    renderPanel('radio-io-dm32uv');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for UV-5R Mini after drop-stash', () => {
    renderPanel('radio-io-uv5r-mini');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for OpenGD77 DM-1701 after drop-stash', () => {
    renderPanel('radio-io-opengd77-1701');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for OpenGD77 MD-9600 after drop-stash', () => {
    renderPanel('radio-io-opengd77-md9600');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });
});

describe('BuildRadioIoPanel — no write-panel Read stash (#878)', () => {
  it('does not offer Read from radio on Export', () => {
    renderPanel('radio-io-uv5r-mini');
    expect(screen.queryByRole('button', { name: /Read from radio/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Write requires a prior Read on this egress/i),
    ).not.toBeInTheDocument();
  });
});
