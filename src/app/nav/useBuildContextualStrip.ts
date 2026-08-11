import { useMemo } from 'react';
import { buildSectionNavItems, isBuildDetailPath } from '../routes/builds/nav.ts';
import { useOptionalBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { useFormatBuild } from '../state/useFormatBuilds.ts';
import type { ContextualStripItem } from './contextualStripItems.ts';

/**
 * mk2 B2 — four section strip items for ContextualStrip on build-detail routes.
 */
export function useBuildContextualStrip(pathname: string): readonly ContextualStripItem[] | null {
  const buildId = isBuildDetailPath(pathname)
    ? (pathname.match(/^\/builds\/([^/]+)/)?.[1] ?? null)
    : null;
  const layout = useOptionalBuildLayout();
  const { build: hookBuild } = useFormatBuild(buildId ?? undefined);

  const build = layout?.build ?? hookBuild;

  return useMemo(() => {
    if (!buildId || !build) return null;
    return buildSectionNavItems(build, {
      egressPaths: layout?.egressPaths,
      activeEgress: layout?.activeEgress,
    }).map((item) => ({
      label: item.label,
      to: item.path,
    }));
  }, [build, buildId, layout?.egressPaths, layout?.activeEgress]);
}
