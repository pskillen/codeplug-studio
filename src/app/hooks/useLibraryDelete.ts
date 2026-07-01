import { useCallback } from 'react';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { useLibrary } from '../state/useLibrary.ts';

export function useLibraryDelete() {
  const { deleteEntity } = useLibrary();

  return useCallback(
    async (kind: LibraryEntityKind, id: string, name: string) => {
      if (!window.confirm(`Delete “${name}”?`)) return;
      const outcome = await deleteEntity(kind, id);
      if (!outcome.ok) {
        const where = outcome.references.map((r) => `• ${r.fromName} (${r.relationship})`).join('\n');
        window.alert(`Cannot delete “${name}” — still referenced by:\n\n${where}`);
      }
    },
    [deleteEntity],
  );
}
