import { useState } from 'react';
import { entityKindLabel } from '@core/services/projectSyncSummary.ts';
import type { ProjectEntityChange } from '@core/services/projectEntityDiff.ts';
import Button from '../v2/Button.tsx';
import Pill, { type PillTone } from '../v2/Pill.tsx';
import classes from './InterchangeOverwriteModal.module.css';

const COLLAPSED_CHANGE_ROWS = 8;

const CHANGE_PILL: Record<ProjectEntityChange['change'], { tone: PillTone; label: string }> = {
  added: { tone: 'success', label: 'Added' },
  removed: { tone: 'destructive', label: 'Removed' },
  changed: { tone: 'warning', label: 'Changed' },
};

export interface ProjectEntityChangeListProps {
  changes: ProjectEntityChange[];
  /** Shown instead of the list when `changes` is empty. */
  emptyMessage: string;
}

/** Itemised entity changes (added / removed / changed), 8 rows with a Show all toggle. */
export default function ProjectEntityChangeList({
  changes,
  emptyMessage,
}: ProjectEntityChangeListProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleChanges = showAll ? changes : changes.slice(0, COLLAPSED_CHANGE_ROWS);
  const hiddenCount = changes.length - COLLAPSED_CHANGE_ROWS;

  if (changes.length === 0) {
    return <p className={classes.muted}>{emptyMessage}</p>;
  }

  return (
    <>
      <ul className={classes.changeList}>
        {visibleChanges.map((change) => {
          const pill = CHANGE_PILL[change.change];
          return (
            <li key={`${change.kind}:${change.id}`} className={classes.changeRow}>
              <Pill tone={pill.tone}>{pill.label}</Pill>
              <span className={classes.changeLabel}>
                <span className={classes.changeKind}>{entityKindLabel(change.kind)}</span>
                {' · '}
                {change.name}
              </span>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className={classes.toggle}
          onClick={() => setShowAll((prev) => !prev)}
        >
          {showAll ? 'Show fewer' : `Show all ${changes.length} changes`}
        </Button>
      ) : null}
    </>
  );
}
