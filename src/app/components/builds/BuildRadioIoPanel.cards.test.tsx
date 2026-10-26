/**
 * Export panel layout (#1393, PR 4d): header card, Before you write, radio settings and backup
 * cards, and the collapsed coverage table. The serial edge is not touched here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { BuildLayoutProvider } from '../../routes/builds/BuildLayoutContext.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';
import { clearAllOverrides, setOverride, setRead } from '../../state/atD890RadioSettingsSession.ts';
import { addBackupThisSession, resetBackupsThisSession } from '../../state/radioSessionBackups.ts';
import * as backupRestore from '../../services/radioBackupRestore.ts';

const library = vi.hoisted(() => ({
  value: {
    channels: [] as unknown[],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  },
}));

vi.mock('../../lib/loadLibrarySlice.ts', () => ({
  loadLibrarySlice: vi.fn(async () => library.value),
}));

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
    putRadioBuild: vi.fn(async () => ({ ok: true })),
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
  render(
    <MemoryRouter initialEntries={[`/builds/${build.id}/export`]}>
      <BuildLayoutProvider value={layoutValue}>
        <DesignSystemV2Provider>
          <Routes>
            <Route
              path="/builds/:id/export"
              element={<BuildRadioIoPanel build={build} egress={egress} />}
            />
            <Route
              path="/builds/:id/export/radio-settings"
              element={<div data-testid="settings" />}
            />
            <Route path="/builds/:id/backup" element={<div data-testid="backup-page" />} />
          </Routes>
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
  return build;
}

function fmChannel(name: string, rxHz: number) {
  const ch = newChannel('project-1', name);
  ch.rxFrequency = rxHz;
  ch.modeProfiles = [
    {
      mode: 'fm',
      rxTone: 'none',
      txTone: 'none',
      squelch: null,
      bandwidthKHz: null,
      analogSquelchMode: 'default',
    } as never,
  ];
  return ch;
}

beforeEach(() => {
  library.value = { ...library.value, channels: [] };
  resetBackupsThisSession();
});

describe('BuildRadioIoPanel layout, AT-D890UV (#1393)', () => {
  it('has one primary action, the radio settings and backup cards, and no stacked alerts', async () => {
    const build = renderPanel('radio-io-at-d890uv');
    expect(await screen.findByRole('button', { name: 'Write radio…' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Radio settings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Backup' })).toBeInTheDocument();
    expect(screen.getByText('Your radios keep their own settings')).toBeInTheDocument();
    expect(screen.getByText('No backups this session')).toBeInTheDocument();
    // The experimental warning is one line until the link is opened.
    expect(screen.getByText(/Web Serial is experimental/)).toBeInTheDocument();
    expect(screen.queryByText(/riskier than/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // Primary is Write; the cards use secondary buttons.
    expect(screen.getByRole('button', { name: 'Edit settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read a radio' })).toBeInTheDocument();
    expect(build.id).toBeTruthy();
  });

  it('shows the D890 transmit-limits line but no receive-range row without out-of-range channels', async () => {
    renderPanel('radio-io-at-d890uv');
    const section = await screen.findByRole('region', { name: 'Before you write' });
    expect(within(section).getByText(/Transmit limits depend on each radio/)).toBeInTheDocument();
    expect(within(section).queryByText(/receive range/)).toBeNull();
  });

  it('lists channels outside the receive range, expandable, and counts them', async () => {
    library.value = {
      ...library.value,
      channels: [fmChannel('Far out', 10_000_000_000), fmChannel('Fine', 145_500_000)],
    };
    renderPanel('radio-io-at-d890uv');
    const section = await screen.findByRole('region', { name: 'Before you write' });
    expect(await within(section).findByText(/1 channel is outside the/)).toBeInTheDocument();
    expect(within(section).queryByText('Far out')).toBeNull();
    fireEvent.click(within(section).getByRole('button', { name: 'Show' }));
    expect(within(section).getByText('Far out')).toBeInTheDocument();
    expect(within(section).queryByText('Fine')).toBeNull();
  });

  it('summarises the build with the settings changes (D890 only)', async () => {
    const build = renderPanel('radio-io-at-d890uv');
    expect(
      await screen.findByText('0 channels · 0 zones · 0 radio-setting changes'),
    ).toBeInTheDocument();
    act(() => setOverride(build.id, 'keyTone', true));
    expect(
      await screen.findByText('0 channels · 0 zones · 1 radio-setting change'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 change this session')).toBeInTheDocument();
    act(() => clearAllOverrides(build.id));
  });

  it('names the radio the settings were read from', async () => {
    const build = renderPanel('radio-io-at-d890uv');
    act(() =>
      setRead(build.id, {
        serial: 'SN1',
        masterIdName: 'MM9PDY-1',
        readAt: 1,
        bandCode: 3,
        languageLock: 0,
        decoded: {},
      }),
    );
    expect(await screen.findByText('No changes · read from MM9PDY-1')).toBeInTheDocument();
  });

  it('keeps the coverage table collapsed until asked', async () => {
    renderPanel('radio-io-at-d890uv');
    const toggle = await screen.findByRole('button', { name: 'What Write updates' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Write coverage|Codeplug channels/i)).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide what Write updates' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('Edit settings opens the settings page', async () => {
    renderPanel('radio-io-at-d890uv');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit settings' }));
    expect(await screen.findByTestId('settings')).toBeInTheDocument();
  });

  it('Back up a radio opens the Backup page', async () => {
    renderPanel('radio-io-at-d890uv');
    fireEvent.click(await screen.findByRole('button', { name: 'Back up a radio' }));
    expect(await screen.findByTestId('backup-page')).toBeInTheDocument();
  });

  it('Write radio… opens the stepper', async () => {
    renderPanel('radio-io-at-d890uv');
    fireEvent.click(await screen.findByRole('button', { name: 'Write radio…' }));
    expect(await screen.findByRole('button', { name: 'Connect & read' })).toBeInTheDocument();
  });

  it('shows the last backup this session', async () => {
    const build = renderPanel('radio-io-at-d890uv');
    act(() => addBackupThisSession(build.id, { serial: 'SN-1', name: 'MM9PDY-1', at: Date.now() }));
    await waitFor(() =>
      expect(screen.getByText(/Last backup this session: .* \(MM9PDY-1\)/)).toBeInTheDocument(),
    );
  });
});

describe('BuildRadioIoPanel layout, other radios (#1393)', () => {
  it('DM-32UV: header and backup card, no radio settings card, no transmit-limits line', async () => {
    renderPanel('radio-io-dm32uv');
    expect(await screen.findByRole('button', { name: 'Write radio…' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Backup' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Radio settings' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Before you write' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'What Write updates' })).toBeNull();
    expect(screen.queryByText(/radio-setting change/)).toBeNull();
  });

  it('a radio without backup support has no backup card', async () => {
    const spy = vi.spyOn(backupRestore, 'descriptorSupportsBackup').mockReturnValue(false);
    renderPanel('radio-io-uv5r-mini');
    expect(await screen.findByRole('button', { name: 'Write radio…' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Backup' })).toBeNull();
    spy.mockRestore();
  });
});
