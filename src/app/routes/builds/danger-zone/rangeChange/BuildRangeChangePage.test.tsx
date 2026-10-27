import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';
import { DesignSystemV2Provider } from '../../../../components/v2/index.ts';
import { BuildLayoutProvider } from '../../BuildLayoutContext.tsx';
import BuildRangeChangePage from './BuildRangeChangePage.tsx';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

afterEach(() => window.localStorage.clear());

function renderPage(profileId: string, path = 'frequency-range', csvOnly = false) {
  const built = newRadioBuildForProfile('proj', profileId);
  const { build, egress } = built;
  const egressPaths = csvOnly
    ? built.egressPaths.filter((p) => p.formatId !== 'radio-io')
    : built.egressPaths;
  const wrap = (el: React.ReactNode) => (
    <BuildLayoutProvider
      value={{
        build,
        buildId: build.id,
        egressPaths,
        activeEgress: egress,
        setActiveEgressId: () => {},
        reloadEgressPaths: async () => {},
      }}
    >
      <DesignSystemV2Provider>{el}</DesignSystemV2Provider>
    </BuildLayoutProvider>
  );
  const router = createMemoryRouter(
    [
      {
        path: '/builds/:id/export/danger-zone/frequency-range',
        element: wrap(<BuildRangeChangePage />),
      },
      {
        path: '/builds/:id/export/danger-zone/frequency-range/resume',
        element: wrap(<BuildRangeChangePage mode="resume" />),
      },
      { path: '/builds/:id/export', element: <p>EXPORT PAGE</p> },
    ],
    { initialEntries: [`/builds/${build.id}/export/danger-zone/${path}`] },
  );
  render(<RouterProvider router={router} />);
}

describe('BuildRangeChangePage', () => {
  it('opens on step 1 with the strap, the stepper and the compact "1 of 8" line', () => {
    renderPage('radio-io-at-d890uv');
    expect(screen.getByRole('heading', { level: 1, name: 'Change frequency range' })).toBeVisible();
    expect(
      screen.getByText("These change the radio itself. A Write can't undo them."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connect the radio you want to change. Studio reads who it is. Nothing is written.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect & read' })).toBeInTheDocument();
    expect(screen.getByTestId('range-compact-steps')).toHaveTextContent('1 of 8 · Read');
    const nav = screen.getByRole('navigation', { name: 'Change frequency range steps' });
    expect(nav.querySelectorAll('li')).toHaveLength(8);
  });

  it('the resume path opens the resume step with no stepper', () => {
    renderPage('radio-io-at-d890uv', 'frequency-range/resume');
    expect(screen.getByRole('heading', { name: 'Finish a range change' })).toBeInTheDocument();
    expect(screen.queryByTestId('range-compact-steps')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose backup file…' })).toBeInTheDocument();
  });

  it('redirects to Export for a DM-32 build and for a build with no Web Serial egress', () => {
    renderPage('radio-io-dm32uv');
    expect(screen.getByText('EXPORT PAGE')).toBeInTheDocument();
  });

  it('redirects to Export for a D890 build with no Web Serial egress', () => {
    renderPage('radio-io-at-d890uv', 'frequency-range', true);
    expect(screen.getByText('EXPORT PAGE')).toBeInTheDocument();
  });
});
