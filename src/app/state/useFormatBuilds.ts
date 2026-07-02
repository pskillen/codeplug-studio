import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { PutResult } from '@integrations/persistence/index.ts';
import { BuildService } from './buildService.ts';
import { persistence } from './persistence.ts';
import { useProjects } from './useProjects.ts';

export interface UseFormatBuildsResult {
  projectId: string | null;
  builds: FormatBuild[];
  loading: boolean;
  reload: () => Promise<void>;
  createBuild: (
    profileId: string,
    name?: string,
  ) => Promise<{ ok: true; build: FormatBuild } | { ok: false; reason: string }>;
  putBuild: (build: FormatBuild, expectedRevision: number | null) => Promise<PutResult>;
  deleteBuild: (id: string) => Promise<void>;
}

export function useFormatBuilds(): UseFormatBuildsResult {
  const { activeProjectId } = useProjects();
  const serviceRef = useRef<BuildService | null>(null);
  serviceRef.current ??= new BuildService(persistence);

  const [builds, setBuilds] = useState<FormatBuild[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeProjectId) {
      setBuilds([]);
      return;
    }
    setBuilds(await serviceRef.current!.listBuilds(activeProjectId));
  }, [activeProjectId]);

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      if (!activeProjectId) {
        setBuilds([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const rows = await serviceRef.current!.listBuilds(activeProjectId);
      if (!cancelled) {
        setBuilds(rows);
        setLoading(false);
      }
    };
    void initialLoad();
    const unsubscribe = persistence.subscribe((change) => {
      if (!cancelled && change.projectId === activeProjectId) {
        void reload();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeProjectId, reload]);

  const createBuild = useCallback(
    async (profileId: string, name?: string) => {
      if (!activeProjectId) {
        return { ok: false as const, reason: 'No active project' };
      }
      const outcome = await serviceRef.current!.createBuild(activeProjectId, profileId, name);
      if (outcome.ok) await reload();
      return outcome;
    },
    [activeProjectId, reload],
  );

  const putBuild = useCallback(
    async (build: FormatBuild, expectedRevision: number | null) => {
      const result = await serviceRef.current!.putBuild(build, expectedRevision);
      if (result.ok) await reload();
      return result;
    },
    [reload],
  );

  const deleteBuild = useCallback(
    async (id: string) => {
      if (!activeProjectId) return;
      await serviceRef.current!.deleteBuild(activeProjectId, id);
      await reload();
    },
    [activeProjectId, reload],
  );

  return useMemo(
    () => ({
      projectId: activeProjectId,
      builds,
      loading,
      reload,
      createBuild,
      putBuild,
      deleteBuild,
    }),
    [activeProjectId, builds, loading, reload, createBuild, putBuild, deleteBuild],
  );
}

export function useFormatBuild(id: string | undefined): {
  build: FormatBuild | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const { builds, loading, reload } = useFormatBuilds();
  const build = useMemo(
    () => (id ? (builds.find((b) => b.id === id) ?? null) : null),
    [builds, id],
  );
  return { build, loading, reload };
}
