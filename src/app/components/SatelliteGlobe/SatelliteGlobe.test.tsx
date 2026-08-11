import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SatelliteGlobe from './SatelliteGlobe.tsx';
import type { GlobeSatellite } from './buildGlobeData.ts';
import type { LiveSatellitePosition } from './useLiveSatellitePositions.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

const SO_50_LINE_1 = '1 27607U 02058C   24045.50000000  .00000123 00000-0  12345-4 0  9992';
const SO_50_LINE_2 = '2 27607  64.5540 100.1234 0069000  90.0000 270.0000 14.7900000 100000';

const mockUseLiveSatellitePositions = vi.fn();
vi.mock('./useLiveSatellitePositions.ts', () => ({
  useLiveSatellitePositions: (...args: unknown[]) => mockUseLiveSatellitePositions(...args),
}));

// react-globe.gl needs a WebGL context jsdom doesn't provide, so it's mocked to a stub that
// exposes the props it was called with — assertions target state/props wiring, not any
// rendered 3D output (see SatelliteGlobe.md — "Testing").
let lastGlobeProps: Record<string, unknown> | null = null;
vi.mock('react-globe.gl', () => ({
  default: (props: Record<string, unknown>) => {
    lastGlobeProps = props;
    return <div data-testid="globe-stub" />;
  },
}));

const satellites: GlobeSatellite[] = [
  {
    id: 'iss',
    name: 'ISS',
    noradId: 25544,
    tleLine1: ISS_LINE_1,
    tleLine2: ISS_LINE_2,
    meanMotionRevPerDay: 15.4956032,
  },
  {
    id: 'so-50',
    name: 'SO-50',
    noradId: 27607,
    tleLine1: SO_50_LINE_1,
    tleLine2: SO_50_LINE_2,
    meanMotionRevPerDay: 14.79,
  },
];

function renderGlobe(overrides: Partial<React.ComponentProps<typeof SatelliteGlobe>> = {}) {
  const onSelectSatellite = vi.fn();
  render(
    <SatelliteGlobe
      observer={{ lat: 52.5, lon: -8.6 }}
      satellites={satellites}
      interestedSatelliteIds={new Set(['iss', 'so-50'])}
      highlightedSatelliteIds={new Set()}
      onSelectSatellite={onSelectSatellite}
      {...overrides}
    />,
  );
  return { onSelectSatellite };
}

describe('SatelliteGlobe', () => {
  it('passes an observer point and one point per satellite with a live position to the globe', () => {
    const livePositions = new Map<string, LiveSatellitePosition>([
      ['iss', { position: [10, 20], altitudeKm: 420, at: '2024-02-14T18:00:00.000Z' }],
      ['so-50', { position: [-5, 30], altitudeKm: 700, at: '2024-02-14T18:00:00.000Z' }],
    ]);
    mockUseLiveSatellitePositions.mockReturnValue(livePositions);

    renderGlobe();

    expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
    const points = lastGlobeProps?.pointsData as { kind: string; id: string }[];
    expect(points).toHaveLength(3); // observer + 2 satellites
    expect(points.find((p) => p.kind === 'observer')).toBeDefined();
    expect(points.map((p) => p.id)).toEqual(expect.arrayContaining(['iss', 'so-50']));
  });

  it('passes lookBehindMin and lookAheadMin through to trail path computation', () => {
    mockUseLiveSatellitePositions.mockReturnValue(new Map());

    renderGlobe({ lookBehindMin: 20, lookAheadMin: 45 });

    const paths = lastGlobeProps?.pathsData as {
      kind: string;
      points: [number, number, number][];
    }[];
    const past = paths.find((p) => p.kind === 'trail-past');
    const future = paths.find((p) => p.kind === 'trail-future');
    expect(past?.points.length).toBeGreaterThan(1);
    expect(future?.points.length).toBeGreaterThan(past!.points.length);
  });

  it('uses gradient path colours and short dashes for past trails', () => {
    mockUseLiveSatellitePositions.mockReturnValue(new Map());

    renderGlobe();

    const pathColor = lastGlobeProps?.pathColor as (path: object) => string | string[];
    const pathDashLength = lastGlobeProps?.pathDashLength as (path: object) => number;
    const pathDashGap = lastGlobeProps?.pathDashGap as (path: object) => number;
    const paths = lastGlobeProps?.pathsData as { kind: string; color: string }[];
    const past = paths.find((p) => p.kind === 'trail-past')!;
    const future = paths.find((p) => p.kind === 'trail-future')!;

    expect(pathColor(past)).toEqual(['#888888', past.color]);
    expect(pathColor(future)).toEqual([future.color, '#888888']);
    expect(pathDashLength(past)).toBe(0.02);
    expect(pathDashGap(past)).toBe(0.02);
    expect(pathDashLength(future)).toBe(1);
    expect(pathDashGap(future)).toBe(0);
  });

  it('omits satellite points until a live position resolves, but still includes orbit trails', () => {
    mockUseLiveSatellitePositions.mockReturnValue(new Map());

    renderGlobe();

    const points = lastGlobeProps?.pointsData as { kind: string }[];
    expect(points.filter((p) => p.kind === 'satellite')).toHaveLength(0);
    expect(points.find((p) => p.kind === 'observer')).toBeDefined();

    const paths = lastGlobeProps?.pathsData as { kind: string; satelliteId: string }[];
    expect(paths.filter((p) => p.kind === 'trail-past')).toHaveLength(2);
    expect(paths.filter((p) => p.kind === 'trail-future')).toHaveLength(2);
    expect(paths.some((p) => p.kind === 'footprint')).toBe(false);

    expect(screen.getByText('Acquiring live satellite positions…')).toBeInTheDocument();
  });

  it('calls onSelectSatellite when a satellite point is clicked, ignoring the observer point', () => {
    mockUseLiveSatellitePositions.mockReturnValue(
      new Map<string, LiveSatellitePosition>([
        ['iss', { position: [10, 20], altitudeKm: 420, at: '2024-02-14T18:00:00.000Z' }],
      ]),
    );
    const { onSelectSatellite } = renderGlobe();

    const onPointClick = lastGlobeProps?.onPointClick as (point: object) => void;
    onPointClick({ kind: 'satellite', id: 'iss', name: 'ISS' });
    expect(onSelectSatellite).toHaveBeenCalledWith('iss');

    onSelectSatellite.mockClear();
    onPointClick({ kind: 'observer', id: 'observer', name: 'Observer' });
    expect(onSelectSatellite).not.toHaveBeenCalled();
  });

  it('hides satellites outside the interest set', () => {
    mockUseLiveSatellitePositions.mockReturnValue(
      new Map<string, LiveSatellitePosition>([
        ['iss', { position: [10, 20], altitudeKm: 420, at: '2024-02-14T18:00:00.000Z' }],
        ['so-50', { position: [-5, 30], altitudeKm: 700, at: '2024-02-14T18:00:00.000Z' }],
      ]),
    );

    renderGlobe({
      interestedSatelliteIds: new Set(['iss']),
      highlightedSatelliteIds: new Set(['iss']),
    });

    const points = lastGlobeProps?.pointsData as { id: string }[];
    expect(points.map((p) => p.id)).toEqual(expect.arrayContaining(['observer', 'iss']));
    expect(points.find((p) => p.id === 'so-50')).toBeUndefined();

    const paths = lastGlobeProps?.pathsData as { kind: string; satelliteId: string }[];
    expect(paths.every((p) => p.satelliteId === 'iss')).toBe(true);
    expect(paths.some((p) => p.satelliteId === 'so-50')).toBe(false);
  });

  it('renders no observer point when the tracking settings have no location', () => {
    mockUseLiveSatellitePositions.mockReturnValue(new Map());

    renderGlobe({ observer: null });

    const points = lastGlobeProps?.pointsData as { kind: string }[];
    expect(points.find((p) => p.kind === 'observer')).toBeUndefined();
  });

  it('passes a custom pollIntervalMs through to useLiveSatellitePositions, single-satellite usage', () => {
    mockUseLiveSatellitePositions.mockReturnValue(new Map());

    const soloSatellite = satellites.slice(0, 1);
    render(
      <SatelliteGlobe
        observer={null}
        satellites={soloSatellite}
        interestedSatelliteIds={new Set(['iss'])}
        highlightedSatelliteIds={new Set()}
        pollIntervalMs={2000}
      />,
    );

    expect(mockUseLiveSatellitePositions).toHaveBeenCalledWith(soloSatellite, 2000);
  });

  it('does not throw when a satellite point is clicked without an onSelectSatellite handler', () => {
    mockUseLiveSatellitePositions.mockReturnValue(
      new Map<string, LiveSatellitePosition>([
        ['iss', { position: [10, 20], altitudeKm: 420, at: '2024-02-14T18:00:00.000Z' }],
      ]),
    );

    render(
      <SatelliteGlobe
        observer={null}
        satellites={satellites.slice(0, 1)}
        interestedSatelliteIds={new Set(['iss'])}
        highlightedSatelliteIds={new Set()}
      />,
    );

    const onPointClick = lastGlobeProps?.onPointClick as (point: object) => void;
    expect(() => onPointClick({ kind: 'satellite', id: 'iss', name: 'ISS' })).not.toThrow();
  });
});
