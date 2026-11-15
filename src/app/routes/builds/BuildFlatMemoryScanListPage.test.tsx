import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildFlatMemoryScanListPage from './BuildFlatMemoryScanListPage.tsx';

function ch(id: string, name: string, mhz: number): Channel {
  return withExportEligibleDefaults({
    ...newChannel('p1', name, ''),
    id,
    rxFrequency: mhz * 1_000_000,
    txFrequency: mhz * 1_000_000,
  });
}

const library: LibrarySlice = {
  channels: [ch('a', 'Alpha', 145.5), ch('b', 'Bravo', 145.6)],
  zones: [],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};

vi.mock('../../lib/loadLibrarySlice.ts', () => ({
  loadLibrarySlice: vi.fn(async () => library),
}));
vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'p1' }),
}));
vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({ putBuild: vi.fn(async () => ({ ok: true })) }),
}));

function renderPage(profileId: string) {
  const { build, egress } = newRadioBuildForProfile('p1', profileId);
  render(
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
          <BuildFlatMemoryScanListPage />
        </BuildLayoutProvider>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  return build;
}

describe('BuildFlatMemoryScanListPage on zone scan set builds', () => {
  for (const profileId of ['radio-io-rt95-mm9pdy', 'radio-io-uv5r-mini-mm9pdy']) {
    it(`${profileId}: Scan in All channels, a Zones link, channel wording and no Memory column`, async () => {
      const build = renderPage(profileId);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Scan in All channels');
      expect(screen.getByRole('link', { name: 'Zones' })).toHaveAttribute(
        'href',
        `/builds/${build.id}/zones`,
      );
      expect(
        await screen.findByText(/keeps a channel out of scanning in All channels only/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/memor/i)).toBeNull();
      expect(screen.queryByRole('columnheader', { name: 'Memory' })).toBeNull();
      expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
    });
  }
});

describe('BuildFlatMemoryScanListPage on a stock flat-memory build', () => {
  it('keeps the memory wording and the Memory column', async () => {
    renderPage('radio-io-uv5r-mini');
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('All channels');
    expect(await screen.findByText(/keeps a memory out of scanning/)).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /Memory/ })).toBeInTheDocument();
  });
});
