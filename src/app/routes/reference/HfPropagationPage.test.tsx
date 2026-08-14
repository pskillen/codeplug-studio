import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RAY_TRACE_DEBOUNCE_MS } from './usePropagationRayTrace.ts';
import HfPropagationPage from './HfPropagationPage.tsx';

const { requestRayTrace } = vi.hoisted(() => ({
  requestRayTrace: vi.fn(async () => [
    {
      mode: 'skywave',
      points: [
        { lat: 0, lon: 0, altitudeKm: 0 },
        { lat: 0, lon: 20, altitudeKm: 0 },
      ],
      takeoffAngleDeg: 20,
      relativeSignalStrength: 0.9,
    },
  ]),
}));

let lastGlobeProps: Record<string, unknown> | null = null;
let lastTopDownProps: Record<string, unknown> | null = null;
let lastSliceProps: Record<string, unknown> | null = null;

vi.mock('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx', () => ({
  default: (props: Record<string, unknown>) => {
    lastGlobeProps = props;
    return <div data-testid="globe-stub" />;
  },
}));

vi.mock('../../components/PropagationTopDownMap/PropagationTopDownMap.tsx', () => ({
  default: (props: Record<string, unknown>) => {
    lastTopDownProps = props;
    return <div data-testid="top-down-stub" />;
  },
}));

vi.mock('../../components/PropagationVerticalSlice/PropagationVerticalSlice.tsx', () => ({
  default: (props: Record<string, unknown>) => {
    lastSliceProps = props;
    return <div data-testid="vertical-slice-stub" />;
  },
}));

vi.mock('@integrations/hfPropagation/rayTraceClient.ts', () => ({
  rayTraceClient: {
    requestRayTrace,
  },
}));

async function renderPage() {
  const view = render(
    <MantineProvider>
      <HfPropagationPage />
    </MantineProvider>,
  );
  await waitFor(() => {
    expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
  });
  return view;
}

beforeEach(() => {
  lastGlobeProps = null;
  lastTopDownProps = null;
  lastSliceProps = null;
  requestRayTrace.mockReset();
  requestRayTrace.mockImplementation(async () => [
    {
      mode: 'skywave',
      points: [
        { lat: 0, lon: 0, altitudeKm: 0 },
        { lat: 0, lon: 20, altitudeKm: 0 },
      ],
      takeoffAngleDeg: 20,
      relativeSignalStrength: 0.9,
    },
  ]);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('HfPropagationPage slice-plane picker', () => {
  it('hides the slice-plane picker until Vertical slice is selected', async () => {
    await renderPage();

    expect(screen.queryByTestId('slice-plane-readout')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vertical slice' }));

    expect(screen.getByTestId('slice-plane-readout')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('vertical-slice-stub')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Bearing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Locator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Address' })).toBeInTheDocument();
  });
});

describe('HfPropagationPage Reading panel', () => {
  it('shows live fc, MUF, and mode, without the peak-gain debug readout', async () => {
    await renderPage();

    expect(screen.getByText('Critical frequency (fc)')).toBeInTheDocument();
    expect(screen.getByText('MUF')).toBeInTheDocument();
    expect(screen.queryByText('Peak gain elevation (debug)')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Skywave')).toBeInTheDocument();
    });
    const mhzReadouts = screen.getAllByText(/\d+\.\d+ MHz/);
    expect(mhzReadouts.length).toBeGreaterThanOrEqual(2);
  });

  it('exposes View, Display toggles, and Reading as labelled controls', async () => {
    await renderPage();

    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Altitude exaggeration' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cutaway plane' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ray corridor' })).toBeInTheDocument();
    expect(screen.getByText('Critical frequency (fc)')).toBeInTheDocument();
    expect(screen.getByText('MUF')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Skywave')).toBeInTheDocument();
    });
  });
});

describe('HfPropagationPage top-down view', () => {
  it('renders the top-down map with the same transmitter and rays, without a second Worker call', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Skywave')).toBeInTheDocument();
    });
    const globeRays = lastGlobeProps?.rays;
    const callsAfterGlobe = requestRayTrace.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Top-down' }));

    await waitFor(() => {
      expect(screen.getByTestId('top-down-stub')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('globe-stub')).not.toBeInTheDocument();
    expect(lastTopDownProps?.transmitter).toEqual({ lat: 0, lon: 0 });
    expect(lastTopDownProps?.rays).toBe(globeRays);
    expect(requestRayTrace.mock.calls.length).toBe(callsAfterGlobe);
  });
});

describe('HfPropagationPage dual ray-trace', () => {
  it('reuses the primary Worker result when the slice bearing matches heading', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Skywave')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Vertical slice' }));
    expect(screen.getByTestId('slice-plane-readout')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(requestRayTrace).toHaveBeenCalledWith(expect.objectContaining({ azimuthDeg: 0 }));
      },
      { timeout: RAY_TRACE_DEBOUNCE_MS + 2000 },
    );
    const callsWhileOffHeading = requestRayTrace.mock.calls.length;

    const bearingThumb = screen.getByRole('slider', { name: 'Slice-plane bearing' });
    for (let i = 0; i < 90; i++) {
      fireEvent.keyDown(bearingThumb, { key: 'ArrowRight' });
    }
    expect(screen.getByTestId('slice-plane-readout')).toHaveTextContent(/090°T/);

    await new Promise((resolve) => {
      setTimeout(resolve, RAY_TRACE_DEBOUNCE_MS + 50);
    });
    expect(requestRayTrace.mock.calls.length).toBe(callsWhileOffHeading);
    await waitFor(() => {
      expect(screen.getByTestId('vertical-slice-stub')).toBeInTheDocument();
    });
    expect((lastSliceProps?.ray as { mode: string } | null)?.mode).toBe('skywave');
    expect(lastSliceProps?.maxRangeM).toBe(4_000_000);
  });

  it('issues a second Worker request when the slice bearing differs from heading', async () => {
    const headingRay = {
      mode: 'skywave' as const,
      points: [
        { lat: 0, lon: 0, altitudeKm: 0 },
        { lat: 0, lon: 20, altitudeKm: 0 },
      ],
      takeoffAngleDeg: 20,
      relativeSignalStrength: 0.9,
    };
    const sliceRay = {
      mode: 'nvis' as const,
      points: [
        { lat: 0, lon: 0, altitudeKm: 0 },
        { lat: 1, lon: 0, altitudeKm: 80 },
      ],
      takeoffAngleDeg: 70,
      relativeSignalStrength: 0.4,
    };
    requestRayTrace.mockImplementation(async (...args: unknown[]) => {
      const params = args[0] as { azimuthDeg: number };
      if (params.azimuthDeg === 0) return [sliceRay];
      return [headingRay];
    });

    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Skywave')).toBeInTheDocument();
    });
    const globeRays = lastGlobeProps?.rays;

    fireEvent.click(screen.getByRole('button', { name: 'Vertical slice' }));
    expect(screen.getByTestId('slice-plane-readout')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(requestRayTrace).toHaveBeenCalledWith(expect.objectContaining({ azimuthDeg: 0 }));
      },
      { timeout: RAY_TRACE_DEBOUNCE_MS + 2000 },
    );
    expect(requestRayTrace).toHaveBeenCalledWith(expect.objectContaining({ azimuthDeg: 90 }));

    await waitFor(
      () => {
        expect((lastSliceProps?.ray as { mode: string } | null)?.mode).toBe('nvis');
      },
      { timeout: RAY_TRACE_DEBOUNCE_MS + 2000 },
    );
    expect(lastSliceProps?.maxRangeM).toBe(4_000_000);
    expect(lastGlobeProps?.rays).toEqual([headingRay]);

    fireEvent.click(screen.getByRole('button', { name: '3D Globe' }));
    await waitFor(() => {
      expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
    });
    expect(lastGlobeProps?.rays).toEqual(globeRays);
    expect(lastGlobeProps?.rays).toEqual([headingRay]);
  });
});

describe('HfPropagationPage copy', () => {
  it('states the idealised-model caveat and uses plain-language Display labels', async () => {
    await renderPage();

    expect(screen.getByText(/idealised atmospheric layers/i)).toBeInTheDocument();
    expect(screen.getByText(/not a coverage guarantee/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cutaway plane' })).toBeInTheDocument();
    expect(screen.getByText(/Hides half the shells along the slice bearing/i)).toBeInTheDocument();
    expect(screen.getByText(/Thicker ribbon along the traced path/i)).toBeInTheDocument();
    expect(screen.queryByText("'nvis'")).not.toBeInTheDocument();
  });
});

describe('HfPropagationPage Display cutaway and corridor', () => {
  it('defaults both toggles off and passes them to the globe', async () => {
    await renderPage();

    expect(screen.getByRole('checkbox', { name: 'Cutaway plane' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ray corridor' })).not.toBeChecked();
    expect(lastGlobeProps?.cutawayEnabled).toBe(false);
    expect(lastGlobeProps?.rayCorridorEnabled).toBe(false);
    expect(lastGlobeProps?.sliceBearingDeg).toBe(0);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Cutaway plane' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ray corridor' }));
    expect(lastGlobeProps?.cutawayEnabled).toBe(true);
    expect(lastGlobeProps?.rayCorridorEnabled).toBe(true);
  });
});

describe('HfPropagationPage transmitter location', () => {
  it('shows labelled 0,0 lat/lon and Use my location in Environment', async () => {
    await renderPage();

    expect(screen.getByText('Transmitter location')).toBeInTheDocument();
    expect(screen.getByText(/Gulf of Guinea/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('0');
    expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument();
    expect(lastGlobeProps?.txLat).toBe(0);
    expect(lastGlobeProps?.txLon).toBe(0);
  });

  it('passes committed coordinates to the globe and retriggers the Worker', async () => {
    await renderPage();
    const lat = screen.getByRole('textbox', { name: 'Latitude' });
    const lon = screen.getByRole('textbox', { name: 'Longitude' });

    fireEvent.change(lat, { target: { value: '51.5' } });
    fireEvent.blur(lat);
    fireEvent.change(lon, { target: { value: '-0.13' } });
    fireEvent.blur(lon);

    await waitFor(() => {
      expect(lastGlobeProps?.txLat).toBe(51.5);
      expect(lastGlobeProps?.txLon).toBe(-0.13);
    });

    await waitFor(
      () => {
        expect(requestRayTrace).toHaveBeenCalledWith(
          expect.objectContaining({ txLat: 51.5, txLon: -0.13 }),
        );
      },
      { timeout: RAY_TRACE_DEBOUNCE_MS + 2000 },
    );
  });

  it('keeps manual lat/lon when geolocation is unavailable, without an extra banner', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    await waitFor(() => {
      expect(screen.getByText(/Location not available/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('0');
    expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('0');
  });
});

describe('HfPropagationPage Reading recompute', () => {
  it('shows an in-panel spinner and keeps the previous globe rays', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Skywave')).toBeInTheDocument();
    });
    const previousRays = lastGlobeProps?.rays;

    let resolveNext: ((value: unknown) => void) | undefined;
    requestRayTrace.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
    );

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Frequency' }), { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByLabelText('Updating reading')).toBeInTheDocument();
    });
    expect(lastGlobeProps?.rays).toBe(previousRays);
    expect(screen.getByText('Skywave')).toBeInTheDocument();

    resolveNext?.([
      {
        mode: 'nvis',
        points: [
          { lat: 0, lon: 0, altitudeKm: 0 },
          { lat: 1, lon: 0, altitudeKm: 80 },
        ],
        takeoffAngleDeg: 70,
        relativeSignalStrength: 0.4,
      },
    ]);

    await waitFor(() => {
      expect(screen.queryByLabelText('Updating reading')).not.toBeInTheDocument();
    });
    expect(screen.getByText('NVIS')).toBeInTheDocument();
  });
});
