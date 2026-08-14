import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

vi.mock('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx', () => ({
  default: (props: Record<string, unknown>) => {
    lastGlobeProps = props;
    return <div data-testid="globe-stub" />;
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

describe('HfPropagationPage slice-plane picker', () => {
  it('hides the slice-plane picker until Vertical slice is selected', async () => {
    await renderPage();

    expect(screen.queryByTestId('slice-plane-readout')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vertical slice' }));

    expect(screen.getByTestId('slice-plane-readout')).toBeInTheDocument();
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
