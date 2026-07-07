import { useCallback, useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { runEntityDeleteFlow } from '../../lib/entityDeleteFlow.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { kindMeta } from '../../routes/library/registry.ts';
import { useLibrary } from '../../state/useLibrary.ts';

export interface EntityListDeleteActionProps {
  kind: LibraryEntityKind;
  entityId: string;
  label: string;
  confirmMessage?: string;
}

export default function EntityListDeleteAction({
  kind,
  entityId,
  label,
  confirmMessage,
}: EntityListDeleteActionProps) {
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
    <Tooltip label={`Delete ${label}`}>
      <ActionIcon
        variant="subtle"
        color="red"
        size="sm"
        loading={busy}
        aria-label={`Delete ${entityName} ${label}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleDelete();
        }}
      >
        <IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
      </ActionIcon>
    </Tooltip>
  );
}
