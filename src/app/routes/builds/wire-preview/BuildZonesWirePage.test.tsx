import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { seedZoneGroupingFromLibrary } from '@core/domain/zoneGroupingLayout.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import { BuildLayoutProvider } from '../BuildLayoutContext.tsx';
import BuildZonesWirePage from './BuildZonesWirePage.tsx';

function ch(id: string, name: string, mhz: number): Channel {
  return withExportEligibleDefaults({
    ...newChannel('p1', name, ''),
    id,
    rxFrequency: mhz * 1_000_000,
    txFrequency: mhz * 1_000_000,
  });
}

const local: Zone = {
  ...newZone('p1', 'Local'),
  id: 'z1',
  members: [
    { kind: 'channel', channelId: 'a' },
    { kind: 'channel', channelId: 'b', includeInScanList: 'skip' },
    { kind: 'channel', channelId: 'c' },
  ],
};

const library: LibrarySlice = {
  channels: [ch('a', 'Alpha', 145.5), ch('b', 'Bravo', 145.6), ch('c', 'Charlie', 145.7)],
  zones: [local],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};

vi.mock('../../../lib/loadLibrarySlice.ts', () => ({
  loadLibrarySlice: vi.fn(async () => library),
}));
vi.mock('../../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'p1' }),
}));
vi.mock('../../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({ putBuild: vi.fn(async () => ({ ok: true })) }),
}));

function renderPage(profileId: string) {
  const { build, egress } = newRadioBuildForProfile('p1', profileId);
  build.layout = { sections: [seedZoneGroupingFromLibrary(library)] };
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <BuildLayoutProvider
          value={{
            build,
            buildId: build.id,
            egressPaths: [egress],
            activeEgress: egress,
            setActiveEgressId: () => {},
            reloadEgressPaths: async () => {},
          }}
        >
          <BuildZonesWirePage />
        </BuildLayoutProvider>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

describe('BuildZonesWirePage on zone scan set builds', () => {
  for (const profileId of ['radio-io-rt95-mm9pdy', 'radio-io-uv5r-mini-mm9pdy']) {
    it(`${profileId}: the intro and the Scan tab show Scan in this zone, not a scan list`, async () => {
      renderPage(profileId);
      expect(await screen.findByText(/Each zone has its own scan set/)).toBeInTheDocument();
      expect(screen.queryByText(/Export scan list column/)).toBeNull();
      expect(screen.queryByLabelText(/as scan list$/)).toBeNull();

      const rows = await screen.findAllByRole('row');
      fireEvent.click(rows.find((r) => r.textContent?.includes('Local'))!);
      fireEvent.click(await screen.findByRole('tab', { name: 'Scan' }));
      expect(await screen.findByText('2 / 3 scan in this zone')).toBeInTheDocument();
      expect(screen.getByText(/Counts the channels Write sends in this zone/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Export as scan list')).toBeNull();
      expect(screen.getByLabelText('Include Alpha in this zone’s scan')).toBeChecked();
      expect(screen.getByLabelText('Include Bravo in this zone’s scan')).not.toBeChecked();
    });
  }
});
