import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ProjectMeta } from '@core/models/project.ts';
import { ProjectContext, type ProjectContextValue } from './ProjectContext.ts';
import { persistence } from './persistence.ts';
import { ProjectStore } from './projectStore.ts';

interface ProjectProviderProps {
  children: ReactNode;
}

export default function ProjectProvider({ children }: ProjectProviderProps) {
  // Lazily created once and kept stable across renders so in-memory project
  // state survives re-renders. A ref (not useMemo) guarantees it is never
  // recreated; callbacks read storeRef.current rather than depending on it.
  const storeRef = useRef<ProjectStore | null>(null);
  storeRef.current ??= new ProjectStore(persistence);

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setProjects(await storeRef.current!.list());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void storeRef
      .current!.list()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createProject = useCallback(
    async (name: string) => {
      const created = await storeRef.current!.create(name);
      await refresh();
      setActiveProjectId(created.projectId);
    },
    [refresh],
  );

  const switchProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
  }, []);

  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      await storeRef.current!.rename(projectId, name);
      await refresh();
    },
    [refresh],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await storeRef.current!.delete(projectId);
      setActiveProjectId((current) => (current === projectId ? null : current));
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<ProjectContextValue>(() => {
    const activeProject = projects.find((p) => p.projectId === activeProjectId) ?? null;
    return {
      projects,
      activeProjectId,
      activeProject,
      loading,
      createProject,
      switchProject,
      renameProject,
      deleteProject,
    };
  }, [
    projects,
    activeProjectId,
    loading,
    createProject,
    switchProject,
    renameProject,
    deleteProject,
  ]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
