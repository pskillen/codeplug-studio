import { IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { runEntityDeleteFlow } from '../../lib/entityDeleteFlow.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { kindMeta } from '../../routes/library/registry.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { RowActionIcon } from '../v2/index.ts';

export interface EntityListRowDeleteActionProps {
  kind: LibraryEntityKind;
  entityId: string;
  label: string;
  confirmMessage?: string;
}

/** v2 DataTable row delete using `RowActionIcon` (destructive tone). */
export default function EntityListRowDeleteAction({
  kind,
  entityId,
  label,
  confirmMessage,
}: EntityListRowDeleteActionProps) {
  const { deleteEntity } = useLibrary();
  const [busy, setBusy] = useState(false);
  const entityName = kindMeta(kind).label.toLowerCase();

  const handleDelete = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await runEntityDeleteFlow({
        kind,
        entityId,
        label,
        deleteEntity,
        confirmMessage,
      });
      if (result.status === 'blocked') {
        window.alert(result.message);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, confirmMessage, deleteEntity, entityId, kind, label]);

  return (
    <RowActionIcon
      tone="destructive"
      label={`Delete ${entityName} ${label}`}
      disabled={busy}
      icon={<IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => void handleDelete()}
    />
  );
}
