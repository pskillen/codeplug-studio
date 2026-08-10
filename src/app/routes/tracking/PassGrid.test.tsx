import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { filterTrackingPasses } from './passTime.ts';
import PassGrid from './PassGrid.tsx';
import type { SatellitePassRow } from './useTrackingPasses.ts';

const PASSES: SatellitePassRow[] = [
  {
    satelliteId: 'sat-1',
    satelliteName: 'ISS',
    tleLine1: '',
    tleLine2: '',
    aosAt: '2026-08-10T01:00:00.000Z',
    losAt: '2026-08-10T01:10:00.000Z',
    maxElevationAt: '2026-08-10T01:05:00.000Z',
    maxElevationDeg: 40,
    durationSec: 600,
  },
  {
    satelliteId: 'sat-2',
    satelliteName: 'AO-91',
    tleLine1: '',
    tleLine2: '',
    aosAt: '2026-08-10T02:00:00.000Z',
    losAt: '2026-08-10T02:08:00.000Z',
    maxElevationAt: '2026-08-10T02:04:00.000Z',
    maxElevationDeg: 10,
    durationSec: 480,
  },
];

describe('PassGrid', () => {
  it('shows every pass with no filters applied', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <PassGrid passes={PASSES} loading={false} error={null} windowLabel="72 hours" />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('cell', { name: 'ISS' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'AO-91' })).toBeInTheDocument();
  });

  it('renders only the pre-filtered satellite rows passed from the dashboard', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <PassGrid
            passes={PASSES.filter((pass) => pass.satelliteId === 'sat-1')}
            allPasses={PASSES}
            totalRowCount={PASSES.length}
            loading={false}
            error={null}
            windowLabel="72 hours"
            hasActiveFilter
            selectedSatelliteIds={new Set(['sat-1'])}
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('cell', { name: 'ISS' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'AO-91' })).not.toBeInTheDocument();
  });

  it('renders only passes that survive the shared min-elevation filter', () => {
    const filtered = filterTrackingPasses(PASSES, '20', new Set());
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <PassGrid
            passes={filtered}
            allPasses={PASSES}
            totalRowCount={PASSES.length}
            loading={false}
            error={null}
            windowLabel="72 hours"
            hasActiveFilter
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('cell', { name: 'ISS' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'AO-91' })).not.toBeInTheDocument();
  });

  it('uses the dynamic window label in the empty-state message', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <PassGrid passes={[]} loading={false} error={null} windowLabel="6 hours" />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText('No upcoming passes in the next 6 hours for your enabled satellites.'),
    ).toBeInTheDocument();
  });
});
