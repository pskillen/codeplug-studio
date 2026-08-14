import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HfPropagationPage from './HfPropagationPage.tsx';

vi.mock('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx', () => ({
  default: () => <div data-testid="globe-stub" />,
}));

vi.mock('@integrations/hfPropagation/rayTraceClient.ts', () => ({
  rayTraceClient: {
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
