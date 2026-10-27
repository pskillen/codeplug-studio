import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';
import { DesignSystemV2Provider } from '../../../../components/v2/index.ts';
import { BuildLayoutProvider } from '../../BuildLayoutContext.tsx';
import BuildRangeChangePage from './BuildRangeChangePage.tsx';
import { DEMO_ACTIONS, RANGE_CHANGE_DEMO_STATES } from './rangeChangeDemo.ts';
import type { UseRangeChangeFlowOptions } from './useRangeChangeFlow.tsx';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

const seen = vi.hoisted(() => ({ initialTargets: [] as (number | undefined)[] }));

// A stand-in flow that starts on Done and, once the page remounts it, on step 1. It shows what the page does
// with the router; the real flow's own behaviour is covered by useRangeChangeFlow.test.tsx.
vi.mock('./useRangeChangeFlow.tsx', async () => {
  const { useState } = await import('react');
  return {
    useRangeChangeFlow: (opts: UseRangeChangeFlowOptions) => {
      const [first] = useState(() => seen.initialTargets.length === 0);
      seen.initialTargets.push(opts.initialTarget);
      const state = (id: string) => RANGE_CHANGE_DEMO_STATES.find((d) => d.id === id)!.view;
      return {
        view: first ? state('done') : state('read'),
        actions: {
          ...DEMO_ACTIONS,
          onChangeBack: () => opts.navigateInBuild('export/danger-zone/frequency-range?target=3'),
        },
      };
    },
  };
});

afterEach(() => {
  window.localStorage.clear();
  seen.initialTargets.length = 0;
});

describe('BuildRangeChangePage, Change back…', () => {
  it('on Done it restarts the flow at step 1 with the old range preselected', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-at-d890uv');
    const page = (
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
        <DesignSystemV2Provider>
          <BuildRangeChangePage />
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    );
    const router = createMemoryRouter(
      [{ path: '/builds/:id/export/danger-zone/frequency-range', element: page }],
      { initialEntries: [`/builds/${build.id}/export/danger-zone/frequency-range`] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByTestId('range-done-heading')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Change back to/ }));

    expect(screen.queryByTestId('range-done-heading')).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect & read' })).toBeInTheDocument();
    expect(seen.initialTargets.at(-1)).toBe(3);
  });
});
