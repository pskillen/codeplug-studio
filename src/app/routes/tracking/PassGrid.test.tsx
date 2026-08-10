import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
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

  it('narrows rows to the checked satellites', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <PassGrid passes={PASSES} loading={false} error={null} windowLabel="72 hours" />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('ISS'));

    expect(screen.getByRole('cell', { name: 'ISS' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'AO-91' })).not.toBeInTheDocument();
  });

  it('combines the satellite filter with the min-elevation filter', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <PassGrid passes={PASSES} loading={false} error={null} windowLabel="72 hours" />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Min elevation (°)'), { target: { value: '20' } });

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
