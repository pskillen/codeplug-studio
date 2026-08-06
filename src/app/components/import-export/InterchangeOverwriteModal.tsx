import type { ProjectSyncDiff } from '@core/services/projectSyncSummary.ts';
import Button from '../v2/Button.tsx';
import ConfirmModal from '../v2/ConfirmModal.tsx';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import ProjectSyncDiffTable from './ProjectSyncDiffTable.tsx';
import classes from '../repeaters/RepeaterListingUpdateDialog.module.css';

export interface InterchangeOverwriteModalProps {
  opened: boolean;
  title: string;
  projectName: string;
  diff: ProjectSyncDiff | null;
  loading?: boolean;
  error?: string | null;
  idMismatch?: boolean;
  localProjectId?: string;
  remoteProjectId?: string;
  onClose: () => void;
  onConfirm: () => void;
  onImportAsNew?: () => void;
}

export default function InterchangeOverwriteModal({
  opened,
  title,
  projectName,
  diff,
  loading = false,
  error = null,
  idMismatch = false,
  localProjectId,
  remoteProjectId,
  onClose,
  onConfirm,
  onImportAsNew,
}: InterchangeOverwriteModalProps) {
  const body = (
    <div className={classes.body}>
      {idMismatch ? (
        <>
          <p className={classes.muted}>
            The linked Drive file belongs to a different project than <strong>{projectName}</strong>.
          </p>
          {localProjectId ? (
            <p className={classes.muted}>Local project id: {localProjectId}</p>
          ) : null}
          {remoteProjectId ? (
            <p className={classes.muted}>Remote project id: {remoteProjectId}</p>
          ) : null}
        </>
      ) : (
        <p className={classes.muted}>
          Overwrite local copy of <strong>{projectName}</strong> with the remote YAML file?
        </p>
      )}
      {diff ? <ProjectSyncDiffTable diff={diff} /> : null}
      {error ? <StatusBanner tone="warning">Import failed: {error}</StatusBanner> : null}
    </div>
  );

  return (
    <DesignSystemV2Provider>
      {idMismatch ? (
        <ModalShell
          open={opened}
          onClose={onClose}
          title={title}
          size="lg"
          iconTone="warning"
          footer={
            <div className={classes.footer}>
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              {onImportAsNew ? (
                <Button variant="secondary" loading={loading} onClick={onImportAsNew}>
                  Import as new project
                </Button>
              ) : null}
              <Button variant="destructive" loading={loading} onClick={onConfirm}>
                Replace local content
              </Button>
            </div>
          }
        >
          {body}
        </ModalShell>
      ) : (
        <ConfirmModal
          open={opened}
          onClose={onClose}
          onConfirm={onConfirm}
          title={title}
          tone="destructive"
          confirmLabel="Overwrite local copy"
          busy={loading}
        >
          {body}
        </ConfirmModal>
      )}
    </DesignSystemV2Provider>
  );
}
