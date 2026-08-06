import { IconAlertTriangle } from '@tabler/icons-react';
import { Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { DriveSaveConflict } from '@core/services/driveSaveConflict.ts';
import { formatSyncTimestamp, type ProjectSyncDiff } from '@core/services/projectSyncSummary.ts';
import { DESKTOP_MIN_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { DesignSystemV2Provider, Button, ModalShell, Pill } from '../v2/index.ts';
import classes from './DriveSaveConflictModal.module.css';

export interface DriveSaveConflictModalProps {
  opened: boolean;
  projectName: string;
  conflict: DriveSaveConflict | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRefreshFromDrive?: () => void;
  onSaveAnyway: () => void;
  onSaveAsNew: () => void;
}

function hasRemoteNewer(conflict: DriveSaveConflict | null): boolean {
  return conflict?.kinds.includes('remoteNewer') ?? false;
}

function hasIdMismatch(conflict: DriveSaveConflict | null): boolean {
  return conflict?.kinds.includes('projectIdMismatch') ?? false;
}

function formatCountsLine(diff: ProjectSyncDiff, side: 'local' | 'remote'): string {
  const summary = side === 'local' ? diff.local : diff.remote;
  const { channels, zones, radioBuilds } = summary.counts;
  return `${channels} channels · ${zones} zones · ${radioBuilds} builds`;
}

function changedSummary(diff: ProjectSyncDiff): string {
  const parts = diff.counts
    .filter((row) => row.delta !== 0)
    .map((row) => `${row.label} ${row.local} → ${row.remote}`);
  return parts.length > 0 ? parts.join(' · ') : 'Counts match — check timestamps below.';
}

function ConflictCards({
  conflict,
  loading,
  onRefreshFromDrive,
  onSaveAnyway,
  mobile,
}: {
  conflict: DriveSaveConflict;
  loading: boolean;
  onRefreshFromDrive?: () => void;
  onSaveAnyway: () => void;
  mobile: boolean;
}) {
  const diff = conflict.diff;
  const remoteEdited = diff.timestamps.find((row) => row.key === 'lastEdited')?.remote;
  const localEdited = diff.timestamps.find((row) => row.key === 'lastEdited')?.local;
  const remoteIsNewer =
    diff.timestamps.find((row) => row.key === 'lastEdited')?.newerSide === 'remote';

  const driveCard = (
    <div className={[classes.versionCard, remoteIsNewer ? classes.versionCardNewer : ''].join(' ')}>
      <div className={classes.versionHeader}>
        <div className={classes.versionLabel}>Google Drive</div>
        {remoteIsNewer ? <Pill tone="accent">Newer</Pill> : null}
      </div>
      <div className={classes.versionTime}>Saved {formatSyncTimestamp(remoteEdited ?? null)}</div>
      <div className={classes.versionStats}>{formatCountsLine(diff, 'remote')}</div>
      {onRefreshFromDrive ? (
        <Button size="sm" loading={loading} onClick={onRefreshFromDrive}>
          Keep Drive version
        </Button>
      ) : (
        <Button size="sm" loading={loading} onClick={onSaveAnyway}>
          Keep Drive version
        </Button>
      )}
    </div>
  );

  const localCard = (
    <div className={classes.versionCard}>
      <div className={classes.versionLabel}>This device</div>
      <div className={classes.versionTime}>Saved {formatSyncTimestamp(localEdited ?? null)}</div>
      <div className={classes.versionStats}>{formatCountsLine(diff, 'local')}</div>
      <Button variant="outline" size="sm" loading={loading} onClick={onSaveAnyway}>
        Keep this version
      </Button>
    </div>
  );

  return (
    <Stack gap="md">
      <Text size="sm" className={classes.lead}>
        Google Drive has a newer save than this device — {formatSyncTimestamp(remoteEdited ?? null)}{' '}
        vs. {formatSyncTimestamp(localEdited ?? null)} here. Review what changed, then choose which
        version to keep.
      </Text>
      <div className={classes.changeBox}>
        <div className={classes.changeTitle}>What&apos;s changed in the Drive version</div>
        <div className={classes.changeLine}>{changedSummary(diff)}</div>
      </div>
      <div className={[classes.versionGrid, mobile ? classes.versionGridMobile : ''].join(' ')}>
        {mobile ? (
          <>
            {driveCard}
            {localCard}
          </>
        ) : (
          <>
            {localCard}
            {driveCard}
          </>
        )}
      </div>
    </Stack>
  );
}

export default function DriveSaveConflictModal({
  opened,
  projectName,
  conflict,
  loading = false,
  error = null,
  onClose,
  onRefreshFromDrive,
  onSaveAnyway,
  onSaveAsNew,
}: DriveSaveConflictModalProps) {
  const isDesktop = useMediaQuery(DESKTOP_MIN_WIDTH_MEDIA_QUERY);
  const remoteNewer = hasRemoteNewer(conflict);
  const idMismatch = hasIdMismatch(conflict);

  let title = 'Save to Google Drive?';
  if (remoteNewer) {
    title = 'Google Drive has changed';
  } else if (idMismatch) {
    title = 'Drive file project mismatch';
  }

  const useDualCards = remoteNewer && conflict?.diff;

  return (
    <DesignSystemV2Provider>
      <ModalShell
        open={opened}
        onClose={onClose}
        title={title}
        icon={<IconAlertTriangle size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        iconTone="warning"
        size={useDualCards ? 'lg' : 'sm'}
        dismissible={!loading}
        footer={
          useDualCards ? (
            <Button variant="ghost" size="sm" onClick={onSaveAsNew} disabled={loading}>
              Save as new file instead
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" loading={loading} onClick={onSaveAnyway}>
                Save anyway
              </Button>
            </>
          )
        }
      >
        <Stack gap="md">
          {useDualCards ? (
            <ConflictCards
              conflict={conflict}
              loading={loading}
              onRefreshFromDrive={onRefreshFromDrive}
              onSaveAnyway={onSaveAnyway}
              mobile={isDesktop === false}
            />
          ) : (
            <>
              {remoteNewer ? (
                <Text size="sm">
                  The linked Drive file was saved more recently on another device. Saving now will
                  overwrite those changes to <strong>{projectName}</strong>.
                </Text>
              ) : null}
              {idMismatch ? (
                <Text size="sm">
                  The linked Drive file belongs to a different project than{' '}
                  <strong>{projectName}</strong>. Saving now will replace that file with your local
                  project.
                </Text>
              ) : null}
            </>
          )}
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : null}
          {!useDualCards ? (
            <Stack gap="xs">
              {remoteNewer && onRefreshFromDrive ? (
                <Button variant="secondary" loading={loading} onClick={onRefreshFromDrive}>
                  Refresh from Drive
                </Button>
              ) : null}
              <Button variant="destructive" loading={loading} onClick={onSaveAnyway}>
                Save anyway
              </Button>
              <Button variant="outline" loading={loading} onClick={onSaveAsNew}>
                Save as new file
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </ModalShell>
    </DesignSystemV2Provider>
  );
}
