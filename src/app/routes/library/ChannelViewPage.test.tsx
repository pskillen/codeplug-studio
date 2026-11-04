import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  emptyLibrary,
  newChannel,
  newRadioBuild,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { addChannelsToZoneMembers } from '@core/domain/zoneMembership.ts';
import type { Channel } from '@core/models/library.ts';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { OperatorPositionProvider } from '../../state/operatorPosition.tsx';
import ChannelViewPage from './ChannelViewPage.tsx';

vi.mock('../../components/CodeplugMap/CodeplugMap.tsx', () => ({ default: () => null }));

const talkGroups = Array.from({ length: 14 }, (_, i) =>
  newTalkGroup('p1', i === 0 ? 'Scotland' : `TG ${i}`, 2350 + i),
);
const rxList = {
  ...newRxGroupList('p1', 'BrandMeister NI'),
  members: talkGroups.map((tg, i) => ({
    ref: { kind: 'talkGroup' as const, id: tg.id },
    ...(i === 0 ? { timeSlotOverride: 1 as const } : {}),
  })),
};

const channel: Channel = {
  ...newChannel('p1', 'Newry', 'GB3NY'),
  rxFrequency: 439_550_000,
  txFrequency: 430_550_000,
  location: { lat: 54.17, lon: -6.34 },
  useLocation: true,
  maidenheadLocator: 'IO64tf',
  modeProfiles: [
    { mode: 'fm', rxTone: '110.9', txTone: '110.9', squelch: null, bandwidthKHz: 12.5 },
    {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 2,
      ownDigitalIdId: null,
      contactRef: null,
      rxGroupListId: rxList.id,
    },
  ],
};
const zone = {
  ...newZone('p1', 'Mourne'),
  members: addChannelsToZoneMembers([], [channel.id]),
};
const library = {
  ...emptyLibrary(),
  channels: [channel],
  zones: [zone],
  talkGroups,
  rxGroupLists: [rxList],
};
const build = { ...newRadioBuild('p1', 'retevis-rt95'), name: 'Handheld' };

vi.mock('../../state/useLibrary.ts', () => ({
  useLibrary: () => ({ library, loading: false, projectId: 'p1' }),
}));
vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({ builds: [build] }),
}));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <OperatorPositionProvider>
        <DesignSystemV2Provider>
          <Routes>
            <Route path="/library/channels/:channelId" element={<ChannelViewPage />} />
            <Route path="/library/channels/:id/edit" element={<p>Editor</p>} />
          </Routes>
        </DesignSystemV2Provider>
      </OperatorPositionProvider>
    </MemoryRouter>,
  );
}

describe('ChannelViewPage', () => {
  it('leads with callsign and name, frequency, tones, zones and builds', () => {
    renderAt(`/library/channels/${channel.id}`);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^GB3NY\s*· Newry$/);
    expect(screen.getByText('439.550 MHz')).toBeInTheDocument();
    expect(screen.getByText(/−9\.000 MHz offset/)).toBeInTheDocument();
    expect(screen.getByText('110.9')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mourne' })).toHaveAttribute(
      'href',
      `/library/zones/${zone.id}`,
    );
    expect(screen.getByRole('link', { name: 'Handheld' })).toBeInTheDocument();
    expect(screen.getByText('Included')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How far is this from me?' })).toBeInTheDocument();
  });

  it('summarises the DMR RX group list, capped with a link to the rest', () => {
    renderAt(`/library/channels/${channel.id}`);
    expect(screen.getAllByRole('link', { name: 'BrandMeister NI' })[0]).toHaveAttribute(
      'href',
      `/library/rx-group-lists/${rxList.id}`,
    );
    expect(screen.getByText('14 talk groups · 1 on TS1')).toBeInTheDocument();
    const members = screen.getByRole('list', { name: 'BrandMeister NI members' });
    expect(members).toHaveTextContent('Scotland2350TS1');
    expect(screen.getByRole('link', { name: '+2 more' })).toBeInTheDocument();
  });

  it('opens the editor from the Edit button', () => {
    renderAt(`/library/channels/${channel.id}`);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();
  });

  it('says so when the channel does not exist', () => {
    renderAt('/library/channels/missing');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Channel not found');
  });
});
