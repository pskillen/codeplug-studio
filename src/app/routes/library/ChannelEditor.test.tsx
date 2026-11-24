import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  mocks.putChannel.mockReset().mockResolvedValue({ ok: true });
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
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
