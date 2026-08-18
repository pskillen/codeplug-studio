/**
 * Blocking modal for Web Serial read/write — uses v2 ProgressModal (R1).
 */

import { Alert, Text } from '@mantine/core';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import { Button, ProgressModal, type ProgressModalStep } from '../v2/index.ts';

/**
 * `'keps-write'` is a distinct operation from `'write'` (#859) — a satellite-keps upload has
 * no assemble-channels-into-image step, no write-verify concept, and no coverage table, so it
 * gets its own step list/title rather than reusing `'write'`'s codeplug-shaped copy.
 * `'restore'` replays a backup zip onto the radio — not Write-codeplug.
 */
export type RadioIoOperation = 'read' | 'write' | 'keps-write' | 'restore';

export type RadioIoProgressPhase =
  'connecting' | 'preparing' | 'transfer' | 'saving' | 'verifying' | 'done';

export type RadioIoWriteVerifyStatus = 'none' | 'unverified' | 'verifying' | 'verified' | 'failed';

export interface RadioIoProgressModalProps {
  opened: boolean;
  operation: RadioIoOperation;
  phase: RadioIoProgressPhase;
  progress: ProgressUpdate | null;
  transferStages?: readonly string[];
  navigationBlocked?: boolean;
  writeVerifyStatus?: RadioIoWriteVerifyStatus;
  requiresCrossSessionReconnect?: boolean;
  verifyButtonEnabled?: boolean;
  onVerify?: () => void;
  onCloseWithoutVerify?: () => void;
  onCancel: () => void;
  onClose?: () => void;
}

interface StepDef {
  id: string;
  label: string;
}

function buildSteps(
  operation: RadioIoOperation,
  transferStages: readonly string[],
  phase: RadioIoProgressPhase,
  writeVerifyStatus: RadioIoWriteVerifyStatus,
): StepDef[] {
  if (operation === 'write') {
    const postUpload = writeVerifyStatus !== 'none' || phase === 'done' || phase === 'verifying';

    if (postUpload) {
      const steps: StepDef[] = [
        { id: 'connecting', label: 'Connect and handshake' },
        { id: 'preparing', label: 'Assemble channels into image' },
        { id: 'transfer', label: 'Upload to radio' },
      ];
      if (writeVerifyStatus !== 'none') {
        steps.push({ id: 'verify', label: 'Verify write (optional)' });
      }
      if (phase === 'done' && writeVerifyStatus === 'verified') {
        steps.push({ id: 'done', label: 'Write complete — verify passed' });
      } else if (phase === 'done' && writeVerifyStatus === 'failed') {
        steps.push({ id: 'done', label: 'Write complete — verify failed' });
      } else if (phase === 'done' && writeVerifyStatus === 'none') {
        steps.push({ id: 'done', label: 'Write complete' });
      }
      return steps;
    }

    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      { id: 'preparing', label: 'Assemble channels into image' },
      ...(transferStages.length > 0
        ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
        : [{ id: 'transfer', label: 'Upload to radio' }]),
    ];
    return steps;
  }
  if (operation === 'keps-write') {
    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      { id: 'preparing', label: 'Pack satellite records' },
      ...(transferStages.length > 0
        ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
        : [{ id: 'transfer', label: 'Upload to radio' }]),
    ];
    if (phase === 'done') {
      steps.push({ id: 'done', label: 'Keps write complete' });
    }
    return steps;
  }
  if (operation === 'restore') {
    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      ...(transferStages.length > 0
        ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
        : [{ id: 'transfer', label: 'Restore archive regions' }]),
    ];
    if (phase === 'done') {
      steps.push({ id: 'done', label: 'Restore complete' });
    }
    return steps;
  }
  const steps: StepDef[] = [
    { id: 'connecting', label: 'Connect and handshake' },
    ...(transferStages.length > 0
      ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
      : [{ id: 'transfer', label: 'Download clone image' }]),
    { id: 'saving', label: 'Save image on this build' },
  ];
  if (phase === 'done') {
    steps.push({ id: 'done', label: 'Read complete' });
  }
  return steps;
}

function activeStepId(
  phase: RadioIoProgressPhase,
  progress: ProgressUpdate | null,
  transferStages: readonly string[],
  writeVerifyStatus: RadioIoWriteVerifyStatus,
): string {
  if (phase === 'connecting') return 'connecting';
  if (phase === 'preparing') return 'preparing';
  if (phase === 'saving') return 'saving';
  if (phase === 'verifying' || writeVerifyStatus === 'verifying') return 'verify';
  if (phase === 'done' && (writeVerifyStatus === 'verified' || writeVerifyStatus === 'failed')) {
    return 'done';
  }
  if (phase === 'done' && writeVerifyStatus === 'unverified') {
    return 'verify';
  }
  if (phase === 'done') return 'done';
  if (progress?.stage) return `stage:${progress.stage}`;
  if (transferStages.length > 0) return `stage:${transferStages[transferStages.length - 1]}`;
  return 'transfer';
}

function stepStatus(
  stepId: string,
  activeId: string,
  steps: readonly StepDef[],
): ProgressModalStep['status'] {
  const stepIdx = steps.findIndex((s) => s.id === stepId);
  const activeIdx = steps.findIndex((s) => s.id === activeId);
  if (stepIdx < 0 || activeIdx < 0) return 'pending';
  if (stepIdx < activeIdx) return 'success';
  if (stepIdx === activeIdx) {
    if (stepId === 'done' && activeId === 'done') {
      return 'success';
    }
    return 'active';
  }
  return 'pending';
}

export function writeDoneAlert(
  writeVerifyStatus: RadioIoWriteVerifyStatus,
  requiresCrossSessionReconnect = true,
): {
  color: string;
  title: string;
  body: string;
} {
  if (writeVerifyStatus === 'verified') {
    return {
      color: 'green',
      title: 'Write finished — verify passed',
      body: 'Every staged block matches what is on the radio now.',
    };
  }
  if (writeVerifyStatus === 'failed') {
    return {
      color: 'red',
      title: 'Write verify failed',
      body: 'Some staged blocks do not match. See the verify report for detail.',
    };
  }
  if (writeVerifyStatus === 'unverified') {
    return {
      color: 'blue',
      title: 'Write finished',
      body: requiresCrossSessionReconnect
        ? 'Wait until the radio shows its normal screen, then Verify write.'
        : 'Click Verify write to compare memory with what was transmitted.',
    };
  }
  if (writeVerifyStatus === 'verifying') {
    return {
      color: 'blue',
      title: 'Verifying write',
      body: 'Reading modelled memory from the radio…',
    };
  }
  return {
    color: 'green',
    title: 'Write finished',
    body: 'All selected blocks were sent.',
  };
}

export default function RadioIoProgressModal({
  opened,
  operation,
  phase,
  progress,
  transferStages = [],
  navigationBlocked = false,
  writeVerifyStatus = 'none',
  requiresCrossSessionReconnect = true,
  verifyButtonEnabled = true,
  onVerify,
  onCloseWithoutVerify,
  onCancel,
  onClose,
}: RadioIoProgressModalProps) {
  const stepDefs = buildSteps(operation, transferStages, phase, writeVerifyStatus);
  const activeId = activeStepId(phase, progress, transferStages, writeVerifyStatus);
  const title =
    operation === 'read'
      ? 'Reading from radio'
      : operation === 'keps-write'
        ? 'Writing keps to radio'
        : operation === 'restore'
          ? 'Restoring backup to radio'
          : 'Writing to radio';
  const percent = progress?.max ? Math.min(100, (100 * progress.cur) / progress.max) : undefined;
  const complete = phase === 'done';
  const verifying = phase === 'verifying' || writeVerifyStatus === 'verifying';
  const awaitingVerify = writeVerifyStatus === 'unverified';
  const showPostUploadAlert = complete || verifying || writeVerifyStatus === 'unverified';

  const steps: ProgressModalStep[] = stepDefs.map((step) => ({
    id: step.id,
    label: step.label,
    detail:
      step.id === 'preparing' && phase === 'preparing' && progress?.msg ? progress.msg : undefined,
    status:
      complete && step.id === 'done' && writeVerifyStatus === 'failed'
        ? 'error'
        : stepStatus(step.id, activeId, stepDefs),
  }));

  const alert =
    operation === 'write' && showPostUploadAlert
      ? writeDoneAlert(writeVerifyStatus, requiresCrossSessionReconnect)
      : complete && operation === 'read'
        ? {
            color: 'green',
            title: 'Read finished',
            body: 'Clone image is saved on this build.',
          }
        : complete && operation === 'keps-write'
          ? {
              color: 'green',
              title: 'Keps write finished',
              body: 'Satellite records were sent to the radio.',
            }
          : complete && operation === 'restore'
            ? {
                color: 'green',
                title: 'Restore finished',
                body: 'Selected restorable regions were sent from the backup file.',
              }
            : null;

  const footer = complete ? (
    awaitingVerify ? (
      <>
        <Button variant="secondary" size="sm" onClick={() => onCloseWithoutVerify?.()}>
          Skip verify
        </Button>
        <Button
          size="sm"
          onClick={() => onVerify?.()}
          disabled={writeVerifyStatus === 'unverified' && !verifyButtonEnabled}
        >
          Verify write
        </Button>
      </>
    ) : (
      <Button size="sm" onClick={() => onClose?.()}>
        Close
      </Button>
    )
  ) : (
    <Button variant="secondary" size="sm" onClick={onCancel}>
      Cancel
    </Button>
  );

  const runningNote =
    !complete && !showPostUploadAlert ? (
      <>
        <Text size="sm">Keep this tab open until the transfer finishes or you cancel.</Text>
        {navigationBlocked && !verifying ? (
          <Alert color="red" title="Stay on this page" mt="sm">
            Navigation is blocked until this transfer finishes or you cancel.
          </Alert>
        ) : null}
      </>
    ) : undefined;

  return (
    <ProgressModal
      open={opened}
      title={title}
      phase={complete ? 'finished' : 'running'}
      steps={steps}
      progress={
        !complete &&
        (phase === 'transfer' ||
          verifying ||
          (phase === 'preparing' && progress != null))
          ? percent
          : undefined
      }
      note={runningNote}
      summary={
        alert ? (
          <Alert color={alert.color} title={alert.title}>
            <Text size="sm">{alert.body}</Text>
          </Alert>
        ) : null
      }
      footer={footer}
      onClose={() => (complete ? onClose?.() : onCancel())}
    />
  );
}
