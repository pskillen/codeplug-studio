/**
 * Blocking modal for Web Serial read/write — uses v2 ProgressModal (R1).
 */

import { useState } from 'react';
import { Alert, Text } from '@mantine/core';
import type { PlannedStage, ProgressUpdate } from '@integrations/radio-io/types.ts';
import RadioIoStageList, { type StageRow } from './RadioIoStageList.tsx';
import {
  START_CURSOR,
  foldStageEvent,
  type CursorRow,
  type StageCursor,
} from './radioIoStageCursor.ts';
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
  /**
   * Stages the adapter declared before the transfer (`planForOperation`). When present the whole
   * list is shown up front in a fixed-height list with an overall bar and time remaining;
   * `transferStages` then only adds stages the plan did not name. Progress only moves forward
   * (see `radioIoStageCursor.ts`). Omitted: the list grows.
   */
  plan?: readonly PlannedStage[];
  navigationBlocked?: boolean;
  writeVerifyStatus?: RadioIoWriteVerifyStatus;
  requiresCrossSessionReconnect?: boolean;
  verifyButtonEnabled?: boolean;
  onVerify?: () => void;
  onCloseWithoutVerify?: () => void;
  onCancel: () => void;
  onClose?: () => void;
  /** Extra sentence on a successful Write or Restore finish. Omitted radios show nothing. */
  successNote?: string;
}

interface StepDef {
  id: string;
  label: string;
}

/** Row id of the transfer stage at `index`. Planned lists may repeat a label, so they use the index. */
function stageId(planned: boolean, index: number, label: string): string {
  return planned ? `stage:${index}` : `stage:${label}`;
}

function buildSteps(
  operation: RadioIoOperation,
  transferStages: readonly string[],
  phase: RadioIoProgressPhase,
  writeVerifyStatus: RadioIoWriteVerifyStatus,
  planned: boolean,
): StepDef[] {
  const stageSteps = (): StepDef[] =>
    transferStages.map((label, i) => ({ id: stageId(planned, i, label), label }));
  if (operation === 'write') {
    const postUpload = writeVerifyStatus !== 'none' || phase === 'done' || phase === 'verifying';

    if (postUpload) {
      const steps: StepDef[] = [
        { id: 'connecting', label: 'Connect and handshake' },
        { id: 'preparing', label: 'Assemble channels into image' },
        // A planned list keeps its rows (all done) so the list does not shrink at the finish.
        ...(planned ? stageSteps() : [{ id: 'transfer', label: 'Upload to radio' }]),
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
        ? stageSteps()
        : [{ id: 'transfer', label: 'Upload to radio' }]),
    ];
    return steps;
  }
  if (operation === 'keps-write') {
    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      { id: 'preparing', label: 'Pack satellite records' },
      ...(transferStages.length > 0
        ? stageSteps()
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
        ? stageSteps()
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
      ? stageSteps()
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
  cursor: StageCursor | null,
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
  if (cursor) {
    // Planned: the cursor only moves forward; before the first event the first stage is current.
    return stageId(
      true,
      Math.max(0, cursor.index),
      transferStages[Math.max(0, cursor.index)] ?? '',
    );
  }
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
  transferStages: grownStages = [],
  plan,
  navigationBlocked = false,
  writeVerifyStatus = 'none',
  requiresCrossSessionReconnect = true,
  verifyButtonEnabled = true,
  onVerify,
  onCloseWithoutVerify,
  onCancel,
  onClose,
  successNote,
}: RadioIoProgressModalProps) {
  const planned = plan != null && plan.length > 0;
  const transferStages: readonly string[] = planned
    ? [...plan.map((p) => p.label), ...grownStages.filter((l) => !plan.some((p) => p.label === l))]
    : grownStages;

  // Fold each event into the stage cursor while rendering (the "adjust state on a prop change"
  // pattern), so the row never lags an event and a re-emitted label cannot move it back.
  const cursorRows: CursorRow[] = planned
    ? [
        ...plan.map((p) => ({
          label: p.label,
          ...(p.optional ? { optional: true } : {}),
          ...(p.passes ? { passes: p.passes } : {}),
          ...(p.coarse ? { coarse: true } : {}),
        })),
        ...transferStages.slice(plan.length).map((label) => ({ label, unplanned: true })),
      ]
    : [];
  const [cursorState, setCursorState] = useState<{
    seen: ProgressUpdate | null;
    cursor: StageCursor;
  }>({ seen: null, cursor: START_CURSOR });
  let cursor = cursorState.cursor;
  if (progress !== cursorState.seen) {
    cursor =
      progress && planned ? foldStageEvent(cursorState.cursor, cursorRows, progress) : START_CURSOR;
    setCursorState({ seen: progress, cursor });
  }

  const stepDefs = buildSteps(operation, transferStages, phase, writeVerifyStatus, planned);
  const activeId = activeStepId(
    phase,
    progress,
    transferStages,
    writeVerifyStatus,
    planned ? cursor : null,
  );
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

  const planByStep = new Map((plan ?? []).map((p, i) => [`stage:${i}`, { p, i }]));
  const stageRows: StageRow[] = steps.map((step) => {
    const hit = planByStep.get(step.id);
    return {
      id: step.id,
      label: typeof step.label === 'string' ? step.label : String(step.id),
      status: step.status,
      ...(typeof step.detail === 'string' ? { detail: step.detail } : {}),
      ...(hit
        ? {
            weight: hit.p.weight,
            ...(hit.p.optional ? { optional: true } : {}),
            ...(hit.p.coarse ? { coarse: true } : {}),
            fraction: cursor.frac[hit.i] ?? 0,
          }
        : {}),
    };
  });
  const stageListBody = planned ? (
    <RadioIoStageList rows={stageRows} progress={progress} />
  ) : undefined;

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

  const showSuccessNote =
    Boolean(successNote) &&
    ((operation === 'write' &&
      phase === 'done' &&
      (writeVerifyStatus === 'none' ||
        writeVerifyStatus === 'unverified' ||
        writeVerifyStatus === 'verified')) ||
      (operation === 'restore' && phase === 'done'));

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
      body={stageListBody}
      progress={
        !complete &&
        (phase === 'transfer' || verifying || (phase === 'preparing' && progress != null))
          ? percent
          : undefined
      }
      note={runningNote}
      summary={
        alert ? (
          <Alert color={alert.color} title={alert.title}>
            <Text size="sm">{alert.body}</Text>
            {showSuccessNote ? (
              <Text size="sm" mt="xs">
                {successNote}
              </Text>
            ) : null}
          </Alert>
        ) : null
      }
      footer={footer}
      onClose={() => (complete ? onClose?.() : onCancel())}
    />
  );
}
