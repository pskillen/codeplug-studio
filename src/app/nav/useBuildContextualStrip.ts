import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EgressPath } from '@core/models/egressPath.ts';
import { buildSectionNavItems, isBuildDetailPath } from '../routes/builds/nav.ts';
import { useOptionalBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { BuildService } from '../state/buildService.ts';
import { persistence } from '../state/persistence.ts';
import { useFormatBuild } from '../state/useFormatBuilds.ts';
import { useProjects } from '../state/useProjects.ts';
import type { ContextualStripItem } from './contextualStripItems.ts';

/**
 * mk2 B2 — four (or five, with Satellite keps) section strip items for
 * ContextualStrip on build-detail routes.
 *
 * `useBuildContextualStrip` is invoked from `AppLayout`, which is an ANCESTOR of
 * `BuildLayoutProvider` (mounted by the `:id` child route in `BuildLayout.tsx`) —
 * not a descendant. `useOptionalBuildLayout()` therefore always returns `null` here,
 * so gating that needs egress-path data (e.g. Satellite keps, #1085) must fetch it
 * independently rather than relying on `BuildLayoutContext`. Mirrors the same
 * fallback already used by `useBuildSubChrome` (`BuildSubChrome.tsx`), which sits at
 * the same `AppLayout` level and has the identical problem for its own nav gating.
 */
export function useBuildContextualStrip(pathname: string): readonly ContextualStripItem[] | null {
  const buildId = isBuildDetailPath(pathname)
    ? (pathname.match(/^\/builds\/([^/]+)/)?.[1] ?? null)
    : null;
  const layout = useOptionalBuildLayout();
  const { build: hookBuild } = useFormatBuild(buildId ?? undefined);
  const { activeProjectId } = useProjects();
  const serviceRef = useRef<BuildService | null>(null);
  serviceRef.current ??= new BuildService(persistence);
  const [localEgressPaths, setLocalEgressPaths] = useState<EgressPath[]>([]);

  const build = layout?.build ?? hookBuild;
  const egressPaths = layout?.egressPaths ?? localEgressPaths;
  const activeEgress = layout?.activeEgress;

  const reloadEgressPaths = useCallback(async () => {
    if (!activeProjectId || !buildId) {
      setLocalEgressPaths([]);
      return;
    }
    setLocalEgressPaths(await serviceRef.current!.listEgressPaths(activeProjectId, buildId));
  }, [activeProjectId, buildId]);

  useEffect(() => {
    if (layout || !buildId) return;
    let cancelled = false;
    const load = async () => {
      if (!activeProjectId) {
        if (!cancelled) setLocalEgressPaths([]);
        return;
      }
      const paths = await serviceRef.current!.listEgressPaths(activeProjectId, buildId);
      if (!cancelled) setLocalEgressPaths(paths);
    };
    void load();
    const unsubscribe = persistence.subscribe((change) => {
      if (!cancelled && change.projectId === activeProjectId) {
        void reloadEgressPaths();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeProjectId, buildId, layout, reloadEgressPaths]);

  return useMemo(() => {
    if (!buildId || !build) return null;
    return buildSectionNavItems(build, {
      egressPaths,
      activeEgress,
    }).map((item) => ({
      label: item.label,
      to: item.path,
    }));
  }, [build, buildId, egressPaths, activeEgress]);
}
