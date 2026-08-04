import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  readStoredActiveEgressId,
  resolveActiveEgress,
} from '../routes/builds/activeEgress.ts';
import { buildNavItems, isBuildDetailPath } from '../routes/builds/nav.ts';
import { useOptionalBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { BuildService } from '../state/buildService.ts';
import { persistence } from '../state/persistence.ts';
import { useFormatBuild } from '../state/useFormatBuilds.ts';
import { useProjects } from '../state/useProjects.ts';
import type { ContextualStripItem } from './contextualStripItems.ts';

/**
 * Trait-shaped build-detail strip items for ContextualStrip. Returns null when
 * not on a build detail route or the build has not loaded yet.
 */
export function useBuildContextualStrip(
  pathname: string,
): readonly ContextualStripItem[] | null {
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
    const activeEgress =
      layout?.activeEgress ??
      (egressPaths.length > 0
        ? resolveActiveEgress(build, egressPaths, readStoredActiveEgressId(build.id))
        : null);
    return buildNavItems(build, { egressPaths, activeEgress }).map((item) => ({
      label: item.label,
      to: item.path,
    }));
  }, [build, buildId, egressPaths, layout?.activeEgress]);
}
