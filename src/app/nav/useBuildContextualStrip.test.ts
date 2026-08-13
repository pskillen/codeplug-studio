import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { useBuildContextualStrip } from './useBuildContextualStrip.ts';

/**
 * #1085 regression: `useBuildContextualStrip` is invoked from `AppLayout`, which
 * is an ANCESTOR of `BuildLayoutProvider` (mounted by the `:id` build-detail child
 * route), not a descendant — so `useOptionalBuildLayout()` always returns `null`
 * at this call site in the real app. These tests render the hook exactly as
 * `AppLayout` does — no `BuildLayoutProvider` wrapper — to prove the Satellite
 * keps nav item appears from real, independently-fetched egress-path data rather
 * than only from a `BuildLayoutContext` value a test harness happens to supply.
 */

const { build, egressPaths } = newRadioBuildForProfile('project-1', 'anytone-at-d890uv');

vi.mock('../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'project-1' }),
}));

vi.mock('../state/persistence.ts', () => ({
  persistence: {
    listRadioBuilds: vi.fn(async () => [build]),
    listEgressPathsForBuild: vi.fn(async () => egressPaths),
    subscribe: vi.fn(() => () => {}),
  },
}));

describe('useBuildContextualStrip (no BuildLayoutProvider ancestor, matching AppLayout)', () => {
  it('includes Satellite keps for a D890 build once egress paths load, with no BuildLayoutContext', async () => {
    const { result } = renderHook(() => useBuildContextualStrip(`/builds/${build.id}/export`));

    await waitFor(() => {
      expect(result.current?.some((item) => item.label === 'Satellite keps')).toBe(true);
    });
  });

  it('omits Satellite keps for a build with no keps-capable egress, still with no BuildLayoutContext', async () => {
    const { build: ogBuild, egressPaths: ogEgressPaths } = newRadioBuildForProfile(
      'project-1',
      'radio-io-uv5r-mini',
    );

    vi.mocked(
      (await import('../state/persistence.ts')).persistence.listRadioBuilds,
    ).mockResolvedValue([ogBuild]);
    vi.mocked(
      (await import('../state/persistence.ts')).persistence.listEgressPathsForBuild,
    ).mockResolvedValue(ogEgressPaths);

    const { result } = renderHook(() => useBuildContextualStrip(`/builds/${ogBuild.id}/export`));

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current?.some((item) => item.label === 'Satellite keps')).toBe(false);
  });
});
