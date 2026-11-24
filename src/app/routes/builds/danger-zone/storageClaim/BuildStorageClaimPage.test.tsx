import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';
import { DesignSystemV2Provider } from '../../../../components/v2/index.ts';
import { BuildLayoutProvider } from '../../BuildLayoutContext.tsx';
import BuildStorageClaimPage from './BuildStorageClaimPage.tsx';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

describe('BuildStorageClaimPage', () => {
  it('shows check step for DM-32UV RadioFoundry', () => {
    const built = newRadioBuildWithEgresses('proj', 'baofeng-dm32uv-radiofoundry');
    const { build, egressPaths } = built;
    const egress = egressPaths.find((p) => p.formatId === 'radio-io')!;
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
          path: '/builds/:id/export/danger-zone/storage-claim',
          element: wrap(<BuildStorageClaimPage />),
        },
      ],
      { initialEntries: [`/builds/${build.id}/export/danger-zone/storage-claim`] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('storage-claim-page')).toBeInTheDocument();
    expect(screen.getByTestId('storage-claim-check')).toBeInTheDocument();
  });
});
