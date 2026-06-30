import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Library } from '@core/models/library.ts';
import { emptyLibrary } from '@core/domain/factories.ts';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { LibraryService, type DeleteOutcome } from './libraryService.ts';
import { persistence } from './persistence.ts';
import { useProjects } from './useProjects.ts';

export interface UseLibraryResult {
  projectId: string | null;
  library: Library;
  loading: boolean;
  reload: () => Promise<void>;
  deleteEntity: (kind: LibraryEntityKind, id: string) => Promise<DeleteOutcome>;
}

export function useLibrary(): UseLibraryResult {
  const { activeProjectId } = useProjects();
  const serviceRef = useRef<LibraryService | null>(null);
  serviceRef.current ??= new LibraryService(persistence);

  const [library, setLibrary] = useState<Library>(emptyLibrary());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeProjectId) {
      setLibrary(emptyLibrary());
      return;
    }
    setLibrary(await serviceRef.current!.loadLibrary(activeProjectId));
  }, [activeProjectId]);

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      if (!activeProjectId) {
        setLibrary(emptyLibrary());
        setLoading(false);
        return;
      }
      setLoading(true);
      const lib = await serviceRef.current!.loadLibrary(activeProjectId);
      if (!cancelled) {
        setLibrary(lib);
        setLoading(false);
      }
    };
    void initialLoad();
    // Refresh when any row for the active project changes (this tab or another).
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

  const deleteEntity = useCallback(
    async (kind: LibraryEntityKind, id: string): Promise<DeleteOutcome> => {
      if (!activeProjectId) return { ok: true };
      const outcome = await serviceRef.current!.deleteWithIntegrity(activeProjectId, kind, id);
      if (outcome.ok) await reload();
      return outcome;
    },
    [activeProjectId, reload],
  );

  return useMemo(
    () => ({ projectId: activeProjectId, library, loading, reload, deleteEntity }),
    [activeProjectId, library, loading, reload, deleteEntity],
  );
}
