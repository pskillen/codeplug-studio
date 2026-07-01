import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PutResult } from '@integrations/persistence/index.ts';
import { listPathForEditorSlug } from '../routes/library/nav.ts';

export interface EntitySaveApi {
  save: (put: () => Promise<PutResult>) => Promise<boolean>;
  saving: boolean;
  error: string | null;
}

/** Shared save flow for entity editors: runs the put, surfaces revision
 * conflicts, and navigates back to the entity list on success. */
export function useEntitySave(editorSlug?: string): EntitySaveApi {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listPath = editorSlug ? listPathForEditorSlug(editorSlug) : '/library/channels';

  const save = useCallback(
    async (put: () => Promise<PutResult>): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const result = await put();
        if (!result.ok) {
          setError(
            result.reason === 'revision_conflict'
              ? 'This entity was changed elsewhere. Reload the page and reapply your edit.'
              : 'Save failed.',
          );
          return false;
        }
        navigate(listPath);
        return true;
      } finally {
        setSaving(false);
      }
    },
    [navigate, listPath],
  );

  return { save, saving, error };
}
