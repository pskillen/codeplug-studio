import { NavLink, Stack } from '@mantine/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { EgressPath } from '@core/models/egressPath.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useOptionalBuildLayout } from '../../../routes/builds/BuildLayoutContext.tsx';
import { buildNavItems } from '../../../routes/builds/nav.ts';
import { BuildService } from '../../../state/buildService.ts';
import { persistence } from '../../../state/persistence.ts';
import { useFormatBuild } from '../../../state/useFormatBuilds.ts';
import { useProjects } from '../../../state/useProjects.ts';

export default function BuildNavLinks() {
  const { id: paramId } = useParams();
  const location = useLocation();
  const buildId = paramId ?? location.pathname.match(/^\/builds\/([^/]+)/)?.[1];
  const layout = useOptionalBuildLayout();
  const { build: hookBuild } = useFormatBuild(buildId);
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
    if (layout) return;
    let cancelled = false;
    const load = async () => {
      if (!activeProjectId || !buildId) {
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

  if (!build) return null;

  return (
    <Stack gap={4}>
      {buildNavItems(build, egressPaths).map((entry) => {
        const Icon = entry.icon;
        return (
          <NavLink
            key={entry.path}
            component={Link}
            to={entry.path}
            label={entry.label}
            leftSection={<Icon size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            active={location.pathname === entry.path}
          />
        );
      })}
    </Stack>
  );
}
