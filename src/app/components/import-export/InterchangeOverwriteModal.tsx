import { useMemo, useState } from 'react';
import { IconAlertTriangle, IconHelpCircle } from '@tabler/icons-react';
import {
  buildProjectSyncReview,
  entityKindLabel,
  formatSyncTimestamp,
  type ProjectSyncDiff,
} from '@core/services/projectSyncSummary.ts';
import type { ProjectEntityChange } from '@core/services/projectEntityDiff.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { backupLocalProjectYaml } from '../../services/projectImportExportService.ts';
import Button from '../v2/Button.tsx';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import Pill, { type PillTone } from '../v2/Pill.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from './InterchangeOverwriteModal.module.css';

/** Where the incoming copy comes from — drives wording only. */
export type InterchangeSource = 'drive' | 'file';

export interface InterchangeOverwriteModalProps {
  opened: boolean;
  /** Override the default "Which copy of {project} do you want?" heading. */
  title?: string;
  projectName: string;
  diff: ProjectSyncDiff | null;
  /** `drive` (default) = Google Drive; `file` = a YAML file the operator opened. */
  source?: InterchangeSource;
  loading?: boolean;
  error?: string | null;
  idMismatch?: boolean;
  /** Local project id — needed for **Back up local YAML**; shown when `idMismatch`. */
  localProjectId?: string;
  remoteProjectId?: string;
  onClose: () => void;
  /** Adopt the incoming copy. */
  onConfirm: () => void;
  onImportAsNew?: () => void;
  /** **Keep this browser's** — defaults to `onClose`. */
  onKeepLocal?: () => void;
}

const COLLAPSED_CHANGE_ROWS = 8;

const CHANGE_PILL: Record<ProjectEntityChange['change'], { tone: PillTone; label: string }> = {
  added: { tone: 'success', label: 'Added' },
  removed: { tone: 'destructive', label: 'Removed' },
  changed: { tone: 'warning', label: 'Changed' },
};

export default function InterchangeOverwriteModal({
  opened,
  title,
  projectName,
  diff,
  source = 'drive',
  loading = false,
  error = null,
  idMismatch = false,
  localProjectId,
  remoteProjectId,
  onClose,
  onConfirm,
  onImportAsNew,
  onKeepLocal,
}: InterchangeOverwriteModalProps) {
  const [showAll, setShowAll] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const review = useMemo(() => (diff ? buildProjectSyncReview(diff) : null), [diff]);
  const sourceLabel = source === 'drive' ? 'Google Drive' : 'File';
  const sourceLower = source === 'drive' ? 'Google Drive' : 'the file';
  const syncedTo = source === 'drive' ? 'to Drive' : 'to file';
  const useLabel = source === 'drive' ? 'Use Drive copy' : 'Use file copy';
  const loss = review?.hasUnsyncedLocalEdits ?? false;
  const destructive = loss || idMismatch;

  async function backUp() {
    if (!localProjectId) return;
    setBackingUp(true);
    setBackupNote(null);
    setBackupError(null);
    try {
      const fileName = await backupLocalProjectYaml(localProjectId);
      setBackupNote(`Downloaded ${fileName}`);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err));
    } finally {
      setBackingUp(false);
    }
  }

  const changes = review?.entityChanges ?? [];
  const visibleChanges = showAll ? changes : changes.slice(0, COLLAPSED_CHANGE_ROWS);
  const hiddenCount = changes.length - COLLAPSED_CHANGE_ROWS;

  const body = (
    <div className={classes.body}>
      {idMismatch ? (
        <>
          <p className={classes.muted}>
            The linked {sourceLower} belongs to a different project than{' '}
            <strong>{projectName}</strong>.
          </p>
          <p className={classes.muted}>
            {localProjectId ? `This browser: ${localProjectId}` : null}
            {localProjectId && remoteProjectId ? ' · ' : null}
            {remoteProjectId ? `${sourceLabel}: ${remoteProjectId}` : null}
          </p>
        </>
      ) : null}
      {diff && review ? (
        <>
          <div className={classes.cards}>
            <section className={classes.card} aria-label="This browser">
              <div className={classes.cardHeader}>This browser</div>
              <div>Last edited {formatSyncTimestamp(diff.local.lastModifiedAt)}</div>
              <div>
                {diff.local.portableSyncedAt
                  ? `Synced ${syncedTo} ${formatSyncTimestamp(diff.local.portableSyncedAt)}`
                  : 'Never synced'}
              </div>
              {loss ? (
                <div className={classes.statusWarn}>Edits not yet synced</div>
              ) : (
                <div className={classes.statusOk}>No unsaved edits</div>
              )}
            </section>
            <section
              className={[classes.card, review.remoteNewer ? classes.cardNewer : '']
                .filter(Boolean)
                .join(' ')}
              aria-label={sourceLabel}
            >
              <div className={classes.cardHeader}>
                {sourceLabel}
                {review.remoteNewer ? <Pill tone="accent">newer</Pill> : null}
              </div>
              <div>Saved {formatSyncTimestamp(diff.remote.lastModifiedAt)}</div>
              <div className={classes.countSummary}>
                {review.countSummary || 'Same number of items'}
              </div>
            </section>
          </div>
          {loss ? (
            <StatusBanner tone="warning">
              Edits made in this browser after {formatSyncTimestamp(review.localSyncedAt)} will be
              lost.
            </StatusBanner>
          ) : null}
          <section className={classes.section} aria-label={`Changes on ${sourceLower}`}>
            <h3 className={classes.sectionTitle}>Changes on {sourceLower}</h3>
            {changes.length === 0 ? (
              <p className={classes.muted}>
                No differences in channels, zones, or other items (only timestamps differ).
              </p>
            ) : (
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
            )}
          </section>
        </>
      ) : null}
      {backupNote ? <p className={classes.muted}>{backupNote}</p> : null}
      {backupError ? (
        <StatusBanner tone="warning">Backup failed: {backupError}</StatusBanner>
      ) : null}
      {error ? <StatusBanner tone="warning">Import failed: {error}</StatusBanner> : null}
    </div>
  );

  const busy = loading || backingUp;

  return (
    <DesignSystemV2Provider>
      <ModalShell
        open={opened}
        onClose={onClose}
        title={title ?? `Which copy of ${projectName} do you want?`}
        size="lg"
        icon={
          idMismatch ? (
            <IconAlertTriangle size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
          ) : (
            <IconHelpCircle size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
          )
        }
        iconTone={idMismatch ? 'warning' : 'accent'}
        dismissible={!loading}
        footer={
          <div className={classes.footer}>
            <Button
              variant="secondary"
              loading={backingUp}
              disabled={!localProjectId || loading}
              onClick={() => void backUp()}
            >
              Back up local YAML
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onKeepLocal ?? onClose}>
              Keep this browser&apos;s
            </Button>
            {idMismatch && onImportAsNew ? (
              <Button variant="secondary" loading={loading} onClick={onImportAsNew}>
                Import as new project
              </Button>
            ) : null}
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              loading={loading}
              disabled={backingUp}
              onClick={onConfirm}
            >
              {idMismatch ? 'Replace local content' : useLabel}
            </Button>
          </div>
        }
      >
        {body}
      </ModalShell>
    </DesignSystemV2Provider>
  );
}
