import { useCallback, useState } from 'react';
import { Alert, Button } from '@mantine/core';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { runEntityDeleteFlow } from '../../lib/entityDeleteFlow.ts';
import { kindMeta } from '../../routes/library/registry.ts';
import { useLibrary } from '../../state/useLibrary.ts';

export interface EntityDeleteButtonProps {
  kind: LibraryEntityKind;
  entityId: string;
  label: string;
  onDeleted?: () => void;
  confirmMessage?: string;
  size?: 'compact-sm' | 'compact-xs' | 'sm';
  variant?: 'light' | 'subtle' | 'filled';
}

export default function EntityDeleteButton({
  kind,
  entityId,
  label,
  onDeleted,
  confirmMessage,
  size = 'compact-sm',
  variant = 'light',
}: EntityDeleteButtonProps) {
  const { deleteEntity } = useLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonLabel = `Delete ${kindMeta(kind).label.toLowerCase()}`;

  const handleDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runEntityDeleteFlow({
        kind,
        entityId,
        label,
        deleteEntity,
        confirmMessage,
      });
      if (result.status === 'deleted') onDeleted?.();
      else if (result.status === 'blocked') setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }, [confirmMessage, deleteEntity, entityId, kind, label, onDeleted]);

  return (
    <>
      <Button
        color="red"
        variant={variant}
        size={size}
        loading={busy}
        onClick={() => void handleDelete()}
      >
        {buttonLabel}
      </Button>
      {error ? (
        <Alert color="red" mt="xs">
          {error}
        </Alert>
      ) : null}
    </>
  );
}
