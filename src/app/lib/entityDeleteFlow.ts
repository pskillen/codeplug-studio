import type { EntityReference } from '@core/domain/references.ts';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import type { DeleteOutcome } from '../state/libraryService.ts';
import { formatEntityReferences } from './entityDeleteMessages.ts';
import { kindMeta } from '../routes/library/registry.ts';

export type EntityDeleteFlowResult =
  { status: 'deleted' } | { status: 'cancelled' } | { status: 'blocked'; message: string };

export type DeleteEntityFn = (kind: LibraryEntityKind, id: string) => Promise<DeleteOutcome>;

export type EntityDeleteCascadeHandler = (context: {
  references: EntityReference[];
}) => Promise<'cascade_applied' | 'cancelled'>;

function defaultConfirmMessage(kind: LibraryEntityKind, label: string): string {
  const entityName = kindMeta(kind).label.toLowerCase();
  if (kind === 'zone') {
    return `Delete zone “${label}”? Channels stay in the library.`;
  }
  return `Delete ${entityName} “${label}”? This cannot be undone.`;
}

export async function runEntityDeleteFlow(options: {
  kind: LibraryEntityKind;
  entityId: string;
  label: string;
  deleteEntity: DeleteEntityFn;
  confirmMessage?: string;
  cascade?: EntityDeleteCascadeHandler;
}): Promise<EntityDeleteFlowResult> {
  const { kind, entityId, label, deleteEntity, confirmMessage, cascade } = options;

  if (!window.confirm(confirmMessage ?? defaultConfirmMessage(kind, label))) {
    return { status: 'cancelled' };
  }

  let result = await deleteEntity(kind, entityId);
  if (result.ok) return { status: 'deleted' };

  if (cascade) {
    const cascadeOutcome = await cascade({ references: result.references });
    if (cascadeOutcome === 'cancelled') return { status: 'cancelled' };
    result = await deleteEntity(kind, entityId);
    if (result.ok) return { status: 'deleted' };
  }

  return {
    status: 'blocked',
    message: `Delete blocked — ${formatEntityReferences(result.references)}`,
  };
}
