import { IconGitCompare } from '@tabler/icons-react';
import { formatSyncTimestamp } from '@core/services/projectSyncSummary.ts';
import type { DriveOutgoingReview } from '../../services/driveOutgoingReviewService.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from '../v2/Button.tsx';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import ProjectEntityChangeList from './ProjectEntityChangeList.tsx';
import classes from './InterchangeOverwriteModal.module.css';

export interface DriveOutgoingChangesModalProps {
  opened: boolean;
  projectName: string;
  /** Name of the linked Drive file. */
  fileName: string;
  review: DriveOutgoingReview | null;
  /** A save started from this dialog is running. */
  saving?: boolean;
  onClose: () => void;
  /** Save to Drive — same flow as the sidebar Save button (still asks first on a conflict). */
  onSave: () => void;
}

/** "What will Save write to Drive?" — read-only review of the outgoing changes. */
export default function DriveOutgoingChangesModal({
  opened,
  projectName,
  fileName,
  review,
  saving = false,
  onClose,
  onSave,
}: DriveOutgoingChangesModalProps) {
  const remoteNewer = review?.conflictKinds.includes('remoteNewer') ?? false;
  const idMismatch = review?.conflictKinds.includes('projectIdMismatch') ?? false;

  return (
    <DesignSystemV2Provider>
      <ModalShell
        open={opened}
        onClose={onClose}
        title={`Changes to save to Google Drive`}
        size="lg"
        icon={<IconGitCompare size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        iconTone="accent"
        dismissible={!saving}
        footer={
          <div className={classes.footer}>
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" loading={saving} onClick={onSave}>
              Save to Drive
            </Button>
          </div>
        }
      >
        <div className={classes.body}>
          <p className={classes.muted}>
            Saving writes this browser&apos;s copy of <strong>{projectName}</strong> over{' '}
            <strong>{fileName}</strong> on Google Drive.
          </p>
          {idMismatch ? (
            <StatusBanner tone="warning">
              The linked Drive file belongs to a different project. Saving will ask before replacing
              it.
            </StatusBanner>
          ) : null}
          {remoteNewer ? (
            <StatusBanner tone="warning">
              Drive has a newer version (saved{' '}
              {formatSyncTimestamp(review?.remoteModifiedAt ?? null)}) than this browser last
              synced. Saving will ask before overwriting it; the list below is measured against that
              newer file.
            </StatusBanner>
          ) : null}
          {review ? (
            <section className={classes.section} aria-label="Changes to Google Drive">
              <h3 className={classes.sectionTitle}>
                Changes to Google Drive
                {review.countSummary ? ` (${review.countSummary})` : ''}
              </h3>
              <ProjectEntityChangeList
                changes={review.entityChanges}
                emptyMessage="No differences in channels, zones, or other items — only timestamps differ."
              />
            </section>
          ) : null}
        </div>
      </ModalShell>
    </DesignSystemV2Provider>
  );
}
