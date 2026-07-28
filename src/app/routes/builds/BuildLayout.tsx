import { Text } from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { orderEgressPathsByCatalog } from '@core/radio-targets/index.ts';
import { FormPage } from '../../components/ui/index.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useFormatBuild } from '../../state/useFormatBuilds.ts';
import { useProjects } from '../../state/useProjects.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import {
  readStoredActiveEgressId,
  resolveActiveEgress,
  writeStoredActiveEgressId,
} from './activeEgress.ts';

function orderedEgressPaths(build: RadioBuild, paths: EgressPath[]): EgressPath[] {
  return orderEgressPathsByCatalog(build.radioTargetId, paths);
}

export default function BuildLayout() {
  const { id } = useParams();
  const { activeProjectId } = useProjects();
  const { build, loading } = useFormatBuild(id);
  const serviceRef = useRef<BuildService | null>(null);
  serviceRef.current ??= new BuildService(persistence);

  const [egressPaths, setEgressPaths] = useState<EgressPath[]>([]);
  /** Operator override for this mount of a build; cleared when `id` changes. */
  const [activeEgressOverrideId, setActiveEgressOverrideId] = useState<string | null>(null);
  const [trackedBuildId, setTrackedBuildId] = useState(id);
  if (id !== trackedBuildId) {
    setTrackedBuildId(id);
    setActiveEgressOverrideId(null);
  }

  const reloadEgressPaths = useCallback(async () => {
    if (!activeProjectId || !id || !build) {
      setEgressPaths([]);
      return;
    }
    const paths = await serviceRef.current!.listEgressPaths(activeProjectId, id);
    setEgressPaths(orderedEgressPaths(build, paths));
  }, [activeProjectId, id, build]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeProjectId || !id || !build) {
        if (!cancelled) {
          setEgressPaths([]);
        }
        return;
      }
      const paths = await serviceRef.current!.listEgressPaths(activeProjectId, id);
      if (!cancelled) {
        setEgressPaths(orderedEgressPaths(build, paths));
      }
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
  }, [activeProjectId, id, build, reloadEgressPaths]);

  const setActiveEgressId = useCallback(
    (egressId: string) => {
      if (!id) return;
      writeStoredActiveEgressId(id, egressId);
      setActiveEgressOverrideId(egressId);
    },
    [id],
  );

  const preferredEgressId = activeEgressOverrideId ?? (id ? readStoredActiveEgressId(id) : null);
  const activeEgress = useMemo(() => {
    if (!build) return null;
    return resolveActiveEgress(build, egressPaths, preferredEgressId);
  }, [build, egressPaths, preferredEgressId]);

  if (loading) {
    return (
      <FormPage title="Loading…">
        <span />
      </FormPage>
    );
  }

  if (!build || !id) {
    return (
      <FormPage title="Build not found">
        <Text>
          <Link to="/builds">← Back to builds</Link>
        </Text>
      </FormPage>
    );
  }

  return (
    <BuildLayoutProvider
      value={{
        build,
        buildId: id,
        egressPaths,
        activeEgress,
        setActiveEgressId,
        reloadEgressPaths,
      }}
    >
      <Outlet />
    </BuildLayoutProvider>
  );
}
