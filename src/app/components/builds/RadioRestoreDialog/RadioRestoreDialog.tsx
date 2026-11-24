/**
 * Restore backup zip in the shared egress dialog (connect → review → restoring → restart → done).
 */

import type { ReactNode } from 'react';
import { Alert, Stack, Text } from '@mantine/core';
import { EgressShell, ErrorPanel, PreflightCard, StageProgress } from '../../egress/index.ts';
import RestartCountdown from '../../radio-io/RestartCountdown.tsx';
import { Button } from '../../v2/index.ts';
import type { WriteShellOptions } from '../../../services/egress/writeShellOptions.ts';
import { RESTORE_RANGE_MISMATCH_NOTE } from '../../../services/radioBackupRestore.ts';
import classes from '../RadioWriteStepper/RadioWriteStepper.module.css';
import { restoreSteps } from './restoreSteps.ts';
import type { RestoreFlowActions, RestoreFlowView } from './useRadioRestoreFlow.ts';

export interface RadioRestoreDialogProps {
  options: WriteShellOptions;
  view: RestoreFlowView;
  actions: RestoreFlowActions;
}

function regionSummary(view: RestoreFlowView): string {
  const backup = view.backup;
  if (!backup) return '';
  const ids = new Set(view.regionIds);
  const labels = backup.manifest.regions
    .filter((r) => r.restoreRole === 'restorable' && ids.has(r.id))
    .map((r) => r.label);
  if (labels.length === 0) return 'No regions selected.';
  return labels.join(', ');
}

export default function RadioRestoreDialog({ options, view, actions }: RadioRestoreDialogProps) {
  let body: ReactNode = null;
  let footer: ReactNode = null;

  switch (view.step) {
    case 'connect':
      body = (
        <div>
          <Text size="sm" mb="sm">
            Connecting to {options.radioLabel}…
          </Text>
          <PreflightCard
            status={
              view.errorOutcome && view.preflight.status !== 'checking'
                ? 'refused'
                : view.preflight.status
            }
            identity={view.preflight.identity}
            rows={view.preflight.rows}
            testId="restore-connect-preflight"
          />
        </div>
      );
      footer = view.errorOutcome ? (
        <Button variant="secondary" size="sm" onClick={actions.onClose}>
          Close
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={actions.onAbort} disabled={!view.busy}>
          Cancel
        </Button>
      );
      break;
    case 'review': {
      const backup = view.backup;
      body = backup ? (
        <Stack gap="sm" className={classes.stack}>
          <Text size="sm">
            Confirm this is the same radio the backup was taken from. Serial mismatch is refused
            before this step — confirm is not a bypass.
          </Text>
          <Text size="sm" fw={600}>
            Radio: {view.identity?.label ?? options.radioLabel}
          </Text>
          {view.rangeMismatch ? (
            <Text size="sm" fw={600} data-testid="restore-range-mismatch">
              {RESTORE_RANGE_MISMATCH_NOTE}
            </Text>
          ) : null}
          <Text size="sm" fw={600}>
            Backup: {backup.manifest.descriptorLabel} · {backup.manifest.radioModelId}
            {backup.manifest.serial ? ` · serial ${backup.manifest.serial}` : ''}
            {` · ${new Date(backup.manifest.capturedAt).toLocaleString()}`}
          </Text>
          {view.identity?.serial || backup.manifest.serial ? (
            <Text size="sm" fw={600} data-testid="restore-live-serial">
              Serial: {view.identity?.serial ?? backup.manifest.serial}
            </Text>
          ) : view.identity?.firmware || backup.manifest.firmware ? (
            <Text size="sm" fw={600}>
              Firmware: {view.identity?.firmware ?? backup.manifest.firmware}
            </Text>
          ) : null}
          <Text size="sm">Regions to restore: {regionSummary(view)}</Text>
          <Text size="xs" c="dimmed">
            {options.restartAfterEndSeconds > 0
              ? `Nothing has been written yet. Cancel writes nothing, but the radio restarts (about ${options.restartAfterEndSeconds} s).`
              : 'Nothing has been written yet. Cancel leaves the radio as it is.'}
          </Text>
        </Stack>
      ) : null;
      footer = (
        <>
          <Button variant="secondary" size="sm" onClick={actions.onCancelReview}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={actions.onRestore}>
            Restore to this radio
          </Button>
        </>
      );
      break;
    }
    case 'restoring':
      body = (
        <div className={classes.stack}>
          <StageProgress
            testId="restore-dialog-progress"
            groups={[{ id: 'restore', rows: view.restoreRows }]}
            progress={view.progress}
            startedAt={view.restoreStartedAt}
            estimateSeconds={null}
            running={view.busy}
          />
          <Text size="xs" c="dimmed">
            Keep this tab open until the transfer finishes or you cancel.
          </Text>
        </div>
      );
      footer = view.errorOutcome ? (
        <Button variant="secondary" size="sm" onClick={actions.onClose}>
          Close
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={actions.onAbort} disabled={!view.busy}>
          Cancel
        </Button>
      );
      break;
    case 'restart':
      body = (
        <div className={classes.stack}>
          <Text size="sm" fw={600}>
            {options.radioLabel}: restore finished.
          </Text>
          <RestartCountdown
            secondsLeft={view.restartSecondsLeft}
            totalSeconds={options.restartAfterEndSeconds}
            data-testid="restore-dialog-restart-wait"
          />
        </div>
      );
      footer = (
        <Button variant="secondary" size="sm" onClick={actions.onClose} disabled={view.busy}>
          Close
        </Button>
      );
      break;
    case 'done':
      body = (
        <Stack gap="sm" className={classes.stack}>
          <Alert color="green" title="Restore complete">
            <Text size="sm">The selected regions are on the radio.</Text>
          </Alert>
          {view.successNote ? (
            <Text size="sm" data-testid="restore-success-note">
              {view.successNote}
            </Text>
          ) : null}
        </Stack>
      );
      footer = (
        <Button variant="secondary" size="sm" onClick={actions.onBackToExport}>
          Back to Export
        </Button>
      );
      break;
  }

  return (
    <EgressShell
      open={view.open}
      onClose={actions.onClose}
      title={`Restore radio · ${options.radioLabel}`}
      dismissible={!view.busy}
      steps={restoreSteps(view, options)}
      busy={view.busy}
      error={
        view.errorOutcome ? (
          <ErrorPanel
            testId="restore-dialog-error"
            outcome={view.errorOutcome}
            retryLabel={view.retryLabel}
            onRetry={view.retryLabel ? actions.onRetry : undefined}
          />
        ) : null
      }
      footer={footer}
    >
      {body}
    </EgressShell>
  );
}
