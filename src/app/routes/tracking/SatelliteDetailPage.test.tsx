import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import { emptyLibrary } from '@core/domain/factories.ts';
import SatelliteDetailPage from './SatelliteDetailPage.tsx';

const SATELLITE: Satellite = {
  id: 'sat-1',
  projectId: 'proj-1',
  revision: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'ISS',
  noradId: 25544,
  enabled: true,
  source: 'celestrak',
  tleLine1: '1 25544U 98067A   26001.00000000  .00000000  00000-0  00000-0 0  9999',
  tleLine2: '2 25544  51.6400   0.0000 0000000   0.0000   0.0000 15.50000000000000',
  epoch: '2026-01-01T00:00:00.000Z',
  classification: 'U',
  inclinationDeg: 51.64,
  raanDeg: 100.1234,
  eccentricity: 0.0001234,
  argPerigeeDeg: 80.5,
  meanAnomalyDeg: 120.25,
  meanMotionRevPerDay: 15.5,
  bstar: 0.0002,
  elementSetNumber: 999,
  revolutionNumber: 12345,
  uplinkHz: 145_800_000,
  downlinkHz: 437_800_000,
  uplinkToneHz: 67.0,
  downlinkToneHz: null,
};

const mockUseLibrary = vi.fn();
vi.mock('../../state/useLibrary.ts', () => ({
  useLibrary: () => mockUseLibrary(),
}));

const mockUseSatelliteEnrichment = vi.fn();
vi.mock('../../state/satelliteEnrichment.tsx', () => ({
  useSatelliteEnrichment: () => mockUseSatelliteEnrichment(),
}));

const mockUsePassesForSatellite = vi.fn();
vi.mock('./usePassesForSatellite.ts', () => ({
  usePassesForSatellite: (...args: unknown[]) => mockUsePassesForSatellite(...args),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <Routes>
          <Route path="/tracking/satellites/:satelliteId" element={<SatelliteDetailPage />} />
        </Routes>
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('SatelliteDetailPage', () => {
  beforeEach(() => {
    mockUseSatelliteEnrichment.mockReturnValue({
      enrichment: [],
      getEnrichmentForNoradId: () => null,
      refreshEnrichmentForNoradIds: vi.fn(),
      clearEnrichment: vi.fn(),
    });
  });

  it('renders the detail panel fields for a known satellite', () => {
    mockUseLibrary.mockReturnValue({
      library: { ...emptyLibrary(), satellites: [SATELLITE] },
      loading: false,
    });
    mockUsePassesForSatellite.mockReturnValue({
      passes: [],
      loading: false,
      error: null,
      hasObserver: true,
    });

    renderAt('/tracking/satellites/sat-1');

    expect(screen.getByText('ISS')).toBeInTheDocument();
    expect(screen.getByText('NORAD 25544')).toBeInTheDocument();
    expect(screen.getByText('25544')).toBeInTheDocument();
    expect(screen.getByText('145.8 MHz')).toBeInTheDocument();
    expect(screen.getByText('437.8 MHz')).toBeInTheDocument();
    expect(screen.getByText('67 Hz')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('renders future and past pass lists', () => {
    mockUseLibrary.mockReturnValue({
      library: { ...emptyLibrary(), satellites: [SATELLITE] },
      loading: false,
    });
    mockUsePassesForSatellite.mockReturnValue({
      passes: [],
      loading: false,
      error: null,
      hasObserver: true,
    });

    renderAt('/tracking/satellites/sat-1');

    expect(screen.getByText('Upcoming passes')).toBeInTheDocument();
    expect(screen.getByText('Past passes')).toBeInTheDocument();
    expect(mockUsePassesForSatellite).toHaveBeenCalled();
    // The page calls the hook for both a future-facing and a past-facing window — assert
    // both directions were requested at least once, regardless of exact render count.
    const windows = mockUsePassesForSatellite.mock.calls.map(
      (call) => call[1] as { fromAt: string; toAt: string },
    );
    expect(windows.some((w) => w.fromAt < w.toAt && new Date(w.toAt).getTime() > Date.now())).toBe(
      true,
    );
    expect(windows.some((w) => w.fromAt < w.toAt && new Date(w.toAt).getTime() <= Date.now())).toBe(
      true,
    );
  });

  it('shows a not-found message for an unknown satellite id', () => {
    mockUseLibrary.mockReturnValue({
      library: { ...emptyLibrary(), satellites: [SATELLITE] },
      loading: false,
    });
    mockUsePassesForSatellite.mockReturnValue({
      passes: [],
      loading: false,
      error: null,
      hasObserver: true,
    });

    renderAt('/tracking/satellites/does-not-exist');

    expect(screen.getByText('Satellite not found')).toBeInTheDocument();
    expect(screen.getByText('Back to Satellite Keps')).toBeInTheDocument();
  });

  it('shows a loading state while the library is loading', () => {
    mockUseLibrary.mockReturnValue({
      library: emptyLibrary(),
      loading: true,
    });
    mockUsePassesForSatellite.mockReturnValue({
      passes: [],
      loading: false,
      error: null,
      hasObserver: false,
    });

    renderAt('/tracking/satellites/sat-1');

    expect(screen.getByText('Loading library…')).toBeInTheDocument();
  });
});
