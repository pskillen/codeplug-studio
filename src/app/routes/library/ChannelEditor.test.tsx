import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { emptyLibrary, newChannel } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import type {
  Channel,
  ChannelModeProfileDMR,
  ChannelModeProfileAnalog,
} from '@core/models/library.ts';
import ChannelEditor from './ChannelEditor.tsx';

const mocks = vi.hoisted(() => ({
  putChannel: vi.fn(),
}));

vi.mock('../../state/persistence.ts', () => ({ persistence: mocks }));
vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'p', activeProject: { id: 'p', name: 'Test' } }),
}));
vi.mock('../../components/CodeplugMap/CodeplugMap.tsx', () => ({ default: () => null }));
vi.mock('../../components/library/PowerLadderHints.tsx', () => ({ default: () => null }));
vi.mock('../../components/library/ChannelZoneMembershipSection.tsx', () => ({
  default: () => null,
}));
vi.mock('../../components/library/ChannelDeleteButton.tsx', () => ({ default: () => null }));
vi.mock('../../components/library/ChannelDuplicateButton.tsx', () => ({ default: () => null }));
vi.mock('../../components/channels/ChannelWireNameExamples.tsx', () => ({ default: () => null }));
vi.mock('../../components/library/ChannelAprsBindingSection.tsx', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../components/library/ChannelAprsBindingSection.tsx')>();
  return { ...actual, default: () => null };
});

function renderNew(library = emptyLibrary()) {
  const router = createMemoryRouter(
    [
      {
        path: '/library/channels/new',
        element: <ChannelEditor projectId="p" library={library} entity={null} />,
      },
      { path: '/library/channels/:id', element: <p data-testid="channel-view">view</p> },
      { path: '/library/channels', element: <p>list</p> },
    ],
    { initialEntries: ['/library/channels/new'] },
  );
  return render(<RouterProvider router={router} />);
}

function renderEdit(channel: Channel, library = emptyLibrary()) {
  const lib = { ...library, channels: [...library.channels, channel] };
  const router = createMemoryRouter(
    [
      {
        path: '/library/channels/:id/edit',
        element: <ChannelEditor projectId="p" library={lib} entity={channel} />,
      },
      { path: '/library/channels/:id', element: <p data-testid="channel-view">view</p> },
    ],
    { initialEntries: [`/library/channels/${channel.id}/edit`] },
  );
  return render(<RouterProvider router={router} />);
}

const realMatchMedia = window.matchMedia;

function setMobile(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile && query === MOBILE_MAX_WIDTH_MEDIA_QUERY,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  mocks.putChannel.mockReset().mockResolvedValue({ ok: true });
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('ChannelEditor (new channel)', () => {
  it('shows the mode placeholder and section nav without legacy Mode settings panel copy', () => {
    renderNew();
    expect(screen.getByRole('group', { name: 'Which mode does this channel use?' })).toBeTruthy();
    expect(screen.queryByText('Mode settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Primary mode')).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Section' });
    for (const label of [
      'Identity',
      'Mode and frequency',
      'Transmit',
      'Names and notes',
      'Location',
      'Scanning',
      'APRS',
    ]) {
      expect(within(nav).getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Modes' })).not.toBeInTheDocument();
  });

  it('blocks invalid M17 fields and saves a canonical destination', async () => {
    renderNew();
    fireEvent.click(screen.getByRole('radio', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'M17' }));
    const access = within(screen.getByRole('group', { name: 'Access' }));
    const call = within(screen.getByRole('group', { name: 'Call' }));
    const can = access.getByLabelText('CAN');
    const destination = call.getByLabelText('Destination');
    const save = screen.getByRole('button', { name: 'Save channel' });

    expect(screen.getByPlaceholderText('No default M17 callsign set')).toHaveValue('');
    expect(screen.getByText('Hears only this CAN.')).toBeInTheDocument();

    fireEvent.change(can, { target: { value: '16' } });
    expect(access.getByText('M17 CAN must be an integer from 0 to 15')).toBeInTheDocument();
    fireEvent.click(save);
    expect(mocks.putChannel).not.toHaveBeenCalled();

    fireEvent.change(can, { target: { value: '3.5' } });
    expect(access.getByText('M17 CAN must be an integer from 0 to 15')).toBeInTheDocument();
    fireEvent.click(save);
    expect(mocks.putChannel).not.toHaveBeenCalled();

    fireEvent.change(can, { target: { value: '3' } });
    fireEvent.click(access.getByRole('switch', { name: 'Play every CAN' }));
    expect(screen.getByText('Hears every CAN.')).toBeInTheDocument();
    fireEvent.change(destination, { target: { value: '@ECHO' } });
    expect(call.getByText(/M17 destination must be blank/)).toBeInTheDocument();
    fireEvent.click(save);
    expect(mocks.putChannel).not.toHaveBeenCalled();

    fireEvent.change(destination, { target: { value: ' m17-m17 a ' } });
    expect(destination).toHaveValue(' m17-m17 a ');
    fireEvent.blur(destination);
    expect(destination).toHaveValue('M17-M17 A');
    fireEvent.change(destination, { target: { value: ' echo ' } });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.putChannel).toHaveBeenCalledTimes(1));
    const [row] = mocks.putChannel.mock.calls[0] as [Channel, unknown];
    expect(row.modeProfiles).toEqual([
      { mode: 'm17', can: 3, playEveryCan: true, destination: 'ECHO' },
    ]);
  });

  it('FM + DMR preset opens dual-mode layout with Main mode FM', () => {
    renderNew();
    fireEvent.click(screen.getByRole('button', { name: /FM \+ DMR/ }));
    expect(screen.getByRole('button', { name: 'Remove FM' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove DMR' })).toBeTruthy();
    expect(screen.getByText('Main mode')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modes' })).toBeTruthy();
  });

  it('saves name-only with empty mode profiles', async () => {
    renderNew();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bare' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save channel' }));
    await waitFor(() => expect(mocks.putChannel).toHaveBeenCalledTimes(1));
    const [row] = mocks.putChannel.mock.calls[0];
    expect(row).toMatchObject({
      name: 'Bare',
      modeProfiles: [],
      primaryMode: null,
    });
  });

  it('preset FM + DMR saves the same profiles and primary as chip order', async () => {
    renderNew();
    fireEvent.click(screen.getByRole('button', { name: /FM \+ DMR/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dual' } });
    fireEvent.change(screen.getByLabelText('RX frequency'), { target: { value: '145.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simplex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save channel' }));
    await waitFor(() => expect(mocks.putChannel).toHaveBeenCalledTimes(1));
    const [row] = mocks.putChannel.mock.calls[0] as [Channel, unknown];
    expect(row.primaryMode).toBe('fm');
    expect(row.modeProfiles).toHaveLength(2);
    expect(row.modeProfiles[0]).toEqual(defaultModeProfile('fm'));
    expect(row.modeProfiles[1]).toEqual(defaultModeProfile('dmr'));
  });
});

describe('ChannelEditor (saved channel)', () => {
  it('inline DMR settings live under Mode and frequency', () => {
    const channel: Channel = {
      ...newChannel('p', 'Relay'),
      id: 'ch-dmr',
      revision: 1,
      modeProfiles: [
        {
          ...(defaultModeProfile('dmr') as ChannelModeProfileDMR),
          colourCode: 1,
          timeslot: 2,
        },
      ],
      primaryMode: 'dmr',
      rxFrequency: 430_000_000,
      txFrequency: 430_000_000,
    };
    renderEdit(channel);
    const modePanel = document.querySelector('#mode');
    expect(modePanel).toBeTruthy();
    expect(within(modePanel as HTMLElement).getByLabelText('Colour code')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Also runs another mode' })).toBeTruthy();
    expect(screen.getByText('DMR CC1 TS2')).toBeTruthy();
  });

  it('switching mode and back restores FM TX tone and a clean footer', () => {
    const channel: Channel = {
      ...newChannel('p', 'FM site'),
      id: 'ch-fm',
      revision: 1,
      modeProfiles: [
        {
          ...(defaultModeProfile('fm') as ChannelModeProfileAnalog),
          rxTone: '94.8',
          txTone: '94.8',
        },
      ],
      primaryMode: 'fm',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    renderEdit(channel);
    const modeRadios = within(screen.getByRole('radiogroup', { name: 'Mode' }));
    fireEvent.click(modeRadios.getByRole('radio', { name: 'DMR' }));
    fireEvent.click(modeRadios.getByRole('radio', { name: 'FM' }));
    const modePanel = document.querySelector('#mode') as HTMLElement;
    expect(within(modePanel).getByLabelText('TX tone frequency')).toHaveValue('94.8 Hz');
    expect(screen.getByText('All changes saved')).toBeTruthy();
  });

  it('save after mode switch does not persist parked profiles', async () => {
    const channel: Channel = {
      ...newChannel('p', 'FM site'),
      id: 'ch-fm-park',
      revision: 1,
      modeProfiles: [defaultModeProfile('fm') as ChannelModeProfileAnalog],
      primaryMode: 'fm',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    renderEdit(channel);
    const modeRadios = within(screen.getByRole('radiogroup', { name: 'Mode' }));
    fireEvent.click(modeRadios.getByRole('radio', { name: 'DMR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save channel' }));
    await waitFor(() => expect(mocks.putChannel).toHaveBeenCalledTimes(1));
    const [row] = mocks.putChannel.mock.calls[0] as [Channel, unknown];
    expect(row.primaryMode).toBe('dmr');
    expect(row.modeProfiles).toEqual([defaultModeProfile('dmr')]);
    expect(row).not.toHaveProperty('parked');
  });

  it('shows Main mode on the primary section and Make main on others', () => {
    const channel: Channel = {
      ...newChannel('p', 'Dual'),
      id: 'ch-dual-sections',
      revision: 1,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'fm',
    };
    renderEdit(channel);
    const fmSection = document.getElementById('mode-fm') as HTMLElement;
    const dmrSection = document.getElementById('mode-dmr') as HTMLElement;
    expect(within(fmSection).getByText('Main mode')).toBeInTheDocument();
    expect(within(dmrSection).getByRole('button', { name: 'Make main, DMR' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Main mode' })).not.toBeInTheDocument();
  });

  it('Make main moves the badge without reordering mode sections', async () => {
    const channel: Channel = {
      ...newChannel('p', 'Dual'),
      id: 'ch-dual-make-main',
      revision: 1,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'fm',
    };
    renderEdit(channel);
    fireEvent.click(screen.getByRole('button', { name: 'Make main, DMR' }));
    expect(
      within(document.getElementById('mode-dmr') as HTMLElement).getByText('Main mode'),
    ).toBeTruthy();
    const sectionIds = [
      ...(document.getElementById('modes')?.querySelectorAll('section') ?? []),
    ].map((s) => s.id);
    expect(sectionIds).toEqual(['mode-fm', 'mode-dmr']);
    fireEvent.click(screen.getByRole('button', { name: 'Save channel' }));
    await waitFor(() => expect(mocks.putChannel).toHaveBeenCalledTimes(1));
    const [row] = mocks.putChannel.mock.calls[0] as [Channel, unknown];
    expect(row.primaryMode).toBe('dmr');
    expect(row.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'dmr']);
  });

  it('folds non-main mode sections on a phone-width viewport with two modes', () => {
    setMobile(true);
    const channel: Channel = {
      ...newChannel('p', 'Dual phone'),
      id: 'ch-dual-phone-fold',
      revision: 1,
      modeProfiles: [
        { ...(defaultModeProfile('fm') as ChannelModeProfileAnalog), txTone: '94.8' },
        {
          ...(defaultModeProfile('dmr') as ChannelModeProfileDMR),
          colourCode: 1,
          timeslot: 2,
        },
      ],
      primaryMode: 'fm',
    };
    renderEdit(channel);
    const fmSection = document.getElementById('mode-fm') as HTMLElement;
    const dmrSection = document.getElementById('mode-dmr') as HTMLElement;
    expect(within(fmSection).getByLabelText('TX tone frequency')).toBeTruthy();
    expect(within(dmrSection).getByText('CC1 TS2')).toBeTruthy();
    expect(within(dmrSection).queryByLabelText('Colour code')).not.toBeInTheDocument();
  });

  it('starts non-main sections folded when three modes are present', () => {
    const channel: Channel = {
      ...newChannel('p', 'Triple'),
      id: 'ch-triple-fold',
      revision: 1,
      modeProfiles: [
        { ...(defaultModeProfile('fm') as ChannelModeProfileAnalog), txTone: '94.8' },
        defaultModeProfile('dmr'),
        defaultModeProfile('nxdn'),
      ],
      primaryMode: 'dmr',
    };
    renderEdit(channel);
    const fmSection = document.getElementById('mode-fm') as HTMLElement;
    const nxdnSection = document.getElementById('mode-nxdn') as HTMLElement;
    const dmrSection = document.getElementById('mode-dmr') as HTMLElement;
    expect(within(fmSection).getByText('T 94.8')).toBeTruthy();
    expect(within(nxdnSection).getByText('Nothing set yet')).toBeTruthy();
    expect(within(dmrSection).getByLabelText('Colour code')).toBeTruthy();
  });

  it('opens a mode section added during the edit', async () => {
    const channel: Channel = {
      ...newChannel('p', 'Triple add'),
      id: 'ch-triple-add',
      revision: 1,
      modeProfiles: [
        defaultModeProfile('fm'),
        defaultModeProfile('dmr'),
        defaultModeProfile('nxdn'),
      ],
      primaryMode: 'dmr',
    };
    renderEdit(channel);
    fireEvent.click(screen.getByRole('button', { name: '+ Add another mode' }));
    await waitFor(() => {
      expect(screen.getAllByRole('menuitem', { hidden: true }).length).toBeGreaterThan(0);
    });
    const ysfItem = screen
      .getAllByRole('menuitem', { hidden: true })
      .find((el) => el.textContent === 'YSF');
    expect(ysfItem).toBeTruthy();
    fireEvent.click(ysfItem!);
    const ysfSection = document.getElementById('mode-ysf') as HTMLElement;
    expect(within(ysfSection).getByLabelText('DG-ID')).toBeTruthy();
  });

  it('passes main mode to the first remaining profile when the main mode is removed', async () => {
    const channel: Channel = {
      ...newChannel('p', 'Dual remove'),
      id: 'ch-dual-remove',
      revision: 1,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'dmr',
    };
    renderEdit(channel);
    fireEvent.click(screen.getByRole('button', { name: 'Remove DMR' }));
    expect(document.getElementById('mode-dmr')).toBeNull();
    expect(document.getElementById('modes')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove DMR' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save channel' }));
    await waitFor(() => expect(mocks.putChannel).toHaveBeenCalledTimes(1));
    const [row] = mocks.putChannel.mock.calls[0] as [Channel, unknown];
    expect(row.primaryMode).toBe('fm');
    expect(row.modeProfiles.map((p) => p.mode)).toEqual(['fm']);
  });

  it('has no vendor-named copy in identity and mode sections this phase owns', () => {
    const channel: Channel = {
      ...newChannel('p', 'Dual'),
      id: 'ch-dual',
      revision: 1,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'fm',
    };
    renderEdit(channel);
    const ownedText = ['identity', 'mode', 'modes']
      .map((id) => document.querySelector(`#${id}`)?.textContent ?? '')
      .join('');
    expect(ownedText).not.toMatch(/Anytone|DM-?32|OpenGD77|RadioFoundry|\bCPS\b/i);
  });
});
