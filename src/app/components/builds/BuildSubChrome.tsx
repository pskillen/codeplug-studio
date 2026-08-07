import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EgressPath } from '@core/models/egressPath.ts';
import { FacetBar, FacetChip } from '../../components/library/FacetBar.tsx';
import { ContextualStrip } from '../v2/index.ts';
import { readStoredActiveEgressId, resolveActiveEgress } from '../../routes/builds/activeEgress.ts';
import {
  activeAuditNavItem,
  activeBuildSection,
  activeWireEntityNavItem,
  buildAuditNavItems,
  buildWireEntityNavItems,
  type BuildAuditNavItem,
  type BuildWireEntityNavItem,
} from '../../routes/builds/nav.ts';
import { isBuildDetailPath } from '../../routes/builds/nav.ts';
import { useOptionalBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useFormatBuild } from '../../state/useFormatBuilds.ts';
import { useProjects } from '../../state/useProjects.ts';
import classes from './BuildSubChrome.module.css';

export interface BuildSubChromeModel {
  section: ReturnType<typeof activeBuildSection>;
  wireEntities: readonly BuildWireEntityNavItem[];
  activeWireEntity: BuildWireEntityNavItem | null;
  auditItems: readonly BuildAuditNavItem[];
  activeAuditItem: BuildAuditNavItem | null;
}

/**
 * Trait-shaped wire-entity chips and About sub-strip for mk2 build workspace (B2).
 */
export function useBuildSubChrome(pathname: string): BuildSubChromeModel | null {
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

    const options = { egressPaths, activeEgress };
    const section = activeBuildSection(pathname, buildId);
    const wireEntities = buildWireEntityNavItems(build, options);
    const auditItems = buildAuditNavItems(build, options);

    return {
      section,
      wireEntities,
      activeWireEntity: activeWireEntityNavItem(pathname, buildId, wireEntities),
      auditItems,
      activeAuditItem: activeAuditNavItem(pathname, buildId, auditItems),
    };
  }, [build, buildId, egressPaths, layout?.activeEgress, pathname]);
}

export default function BuildSubChrome({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const model = useBuildSubChrome(pathname);

  if (!model || !model.section) return null;

  if (model.section === 'wire-preview' && model.wireEntities.length > 0) {
    return (
      <div className={classes.row}>
        <FacetBar scrollable className={classes.chipBar}>
          {model.wireEntities.map((item) => (
            <FacetChip
              key={item.path}
              label={item.label}
              active={model.activeWireEntity?.path === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </FacetBar>
      </div>
    );
  }

  if (model.section === 'audit' && model.auditItems.length > 0) {
    return (
      <div className={classes.row}>
        <ContextualStrip
          items={model.auditItems.map((item) => item.label)}
          active={model.activeAuditItem?.label}
          onChange={(label) => {
            const target = model.auditItems.find((item) => item.label === label);
            if (target) navigate(target.path);
          }}
          className={classes.auditStrip}
        />
      </div>
    );
  }

  return null;
}
