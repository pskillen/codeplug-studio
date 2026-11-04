import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { newChannel, newZone } from '@core/domain/factories.ts';
import { addChannelsToZoneMembers } from '@core/domain/zoneMembership.ts';
import type { Channel } from '@core/models/library.ts';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import GrowZoneRecommendations from './GrowZoneRecommendations.tsx';

vi.mock('../CodeplugMap/CodeplugMap.tsx', () => ({ default: () => null }));

function located(name: string, callsign: string, lat: number, lon: number): Channel {
  return {
    ...newChannel('p1', name, callsign),
    location: { lat, lon },
    useLocation: true,
    rxFrequency: 439_000_000,
    txFrequency: 430_000_000,
  };
}

// Three members around a triangle; two candidates inside it, one with a callsign and one without.
const members = [
  located('North', 'GB3NN', 55.0, -6.0),
  located('South West', 'GB3SW', 54.0, -7.0),
  located('South East', 'GB3SE', 54.0, -5.0),
];
const withCallsign = located('Tandragee', 'GB3TA', 54.4, -6.0);
const withoutCallsign = located('Local simplex', '', 54.3, -6.1);
const zone = {
  ...newZone('p1', 'Armagh'),
  members: addChannelsToZoneMembers(
    [],
    members.map((ch) => ch.id),
  ),
};

vi.mock('../../routes/library/zones/ZoneEditContext.tsx', () => ({
  useZoneEdit: () => ({
    entity: zone,
    previewZone: zone,
    members: zone.members,
    setMembers: vi.fn(),
    library: { channels: [...members, withCallsign, withoutCallsign], zones: [zone] },
  }),
}));

function renderGrow() {
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <GrowZoneRecommendations />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

describe('GrowZoneRecommendations', () => {
  it('shows the callsign beside the name for each candidate', () => {
    renderGrow();

    expect(screen.getByRole('columnheader', { name: /Callsign/ })).toBeInTheDocument();
    const row = screen.getByText('Tandragee').closest('[role="row"]') as HTMLElement;
    expect(within(row).getByText('GB3TA')).toBeInTheDocument();
    expect(screen.getByText('Local simplex')).toBeInTheDocument();
  });

  it('searches candidates by callsign as well as name', () => {
    renderGrow();

    fireEvent.change(screen.getByPlaceholderText('Search callsign or name…'), {
      target: { value: 'gb3ta' },
    });
    expect(screen.getByText('Tandragee')).toBeInTheDocument();
    expect(screen.queryByText('Local simplex')).not.toBeInTheDocument();
  });
});
