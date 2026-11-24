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
import { KEEP_SCREEN_ON_HINT, useScreenWakeLock } from '../../hooks/useScreenWakeLock.ts';
import { Button, ProgressModal, type ProgressModalStep } from '../v2/index.ts';

/**
 * `'restore'` replays a backup zip onto the radio — not Write-codeplug.
 * `'vital-read'` is the AT-D890UV vital-data backup (#1288): it downloads a file and saves nothing on the build.
 * `'library-read'` imports library rows and updates the radio's build.
 */
export type RadioIoOperation =
  'read' | 'library-read' | 'restore' | 'vital-read' | 'safety-read';

export type RadioIoProgressPhase =
  'connecting' | 'preparing' | 'transfer' | 'saving' | 'verifying' | 'done';

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
  onCancel: () => void;
  onClose?: () => void;
  /** Extra sentence on a successful Write or Restore finish. Omitted radios show nothing. */
  successNote?: string;
  /** Extra button beside Close once the run finishes (e.g. Restore's "Back to Export"). */
  finishAction?: { label: string; onClick: () => void };
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
  planned: boolean,
): StepDef[] {
  const stageSteps = (): StepDef[] =>
    transferStages.map((label, i) => ({ id: stageId(planned, i, label), label }));
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
  if (operation === 'safety-read') {
    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      ...(transferStages.length > 0
        ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
        : [{ id: 'transfer', label: 'Read the radio twice' }]),
    ];
    if (phase === 'done') {
      steps.push({ id: 'done', label: 'Safety backup file downloaded' });
    }
    return steps;
  }
  if (operation === 'vital-read') {
    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      ...(transferStages.length > 0
        ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
        : [{ id: 'transfer', label: 'Read vital data' }]),
    ];
    if (phase === 'done') {
      steps.push({ id: 'done', label: 'Vital data file downloaded' });
    }
    return steps;
  }
  const steps: StepDef[] = [
    { id: 'connecting', label: 'Connect and handshake' },
    ...(transferStages.length > 0
      ? stageSteps()
      : [{ id: 'transfer', label: 'Download clone image' }]),
    {
      id: 'saving',
      label:
        operation === 'library-read'
          ? 'Save library and build changes'
          : 'Save image on this build',
    },
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
  cursor: StageCursor | null,
): string {
  if (phase === 'connecting') return 'connecting';
  if (phase === 'preparing') return 'preparing';
  if (phase === 'saving') return 'saving';
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

export default function RadioIoProgressModal({
  opened,
  operation,
  phase,
  progress,
  transferStages: grownStages = [],
  plan,
  navigationBlocked = false,
  onCancel,
  onClose,
  successNote,
  finishAction,
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

  const { held: screenHeld } = useScreenWakeLock(opened && phase !== 'done');

  const stepDefs = buildSteps(operation, transferStages, phase, planned);
  const activeId = activeStepId(phase, progress, transferStages, planned ? cursor : null);
  const libraryRead = operation === 'library-read';
  const savingLibrary = libraryRead && phase === 'saving';
  const title = libraryRead
    ? 'Reading into library'
    : operation === 'read'
      ? 'Reading from radio'
      : operation === 'safety-read'
        ? 'Backing up calibration'
        : operation === 'vital-read'
          ? 'Backing up vital data'
          : operation === 'restore'
              ? 'Restoring backup to radio'
              : 'Reading from radio';
  const percent = progress?.max ? Math.min(100, (100 * progress.cur) / progress.max) : undefined;
  const complete = phase === 'done';

  const steps: ProgressModalStep[] = stepDefs.map((step) => ({
    id: step.id,
    label: step.label,
    detail:
      step.id === 'preparing' && phase === 'preparing' && progress?.msg ? progress.msg : undefined,
    status: stepStatus(step.id, activeId, stepDefs),
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
    complete && (operation === 'read' || libraryRead)
      ? {
          color: 'green',
          title: 'Read finished',
          body: libraryRead
            ? 'Library and build changes are saved.'
            : 'Clone image is saved on this build.',
        }
      : complete && operation === 'safety-read'
        ? {
            color: 'green',
            title: 'Safety backup read finished',
            body: 'The file was downloaded. Confirm on the page that you saved it. Nothing was written to the radio.',
          }
        : complete && operation === 'vital-read'
          ? {
              color: 'green',
              title: 'Vital data backup finished',
              body: 'The file was downloaded. Nothing is saved on this build. The radio restarts when the session ends.',
            }
          : complete && operation === 'restore'
              ? {
                  color: 'green',
                  title: 'Restore finished',
                  body: 'Selected restorable regions were sent from the backup file.',
                }
              : null;

  const showSuccessNote = Boolean(successNote) && operation === 'restore' && phase === 'done';

  const footer = complete ? (
    <>
      {finishAction ? (
        <Button variant="secondary" size="sm" onClick={finishAction.onClick}>
          {finishAction.label}
        </Button>
      ) : null}
      <Button size="sm" onClick={() => onClose?.()}>
        Close
      </Button>
    </>
  ) : savingLibrary ? undefined : (
    <Button variant="secondary" size="sm" onClick={onCancel}>
      Cancel
    </Button>
  );

  const runningNote = !complete ? (
    <>
      <Text size="sm">
        {savingLibrary
          ? 'Keep this tab open while library and build changes are saved.'
          : 'Keep this tab open until the transfer finishes or you cancel.'}
      </Text>
      {!screenHeld ? (
        <Text size="sm" mt="xs" data-testid="keep-screen-on-hint">
          {KEEP_SCREEN_ON_HINT}
        </Text>
      ) : null}
      {navigationBlocked ? (
        <Alert color="red" title="Stay on this page" mt="sm">
          {savingLibrary
            ? 'Navigation is blocked until saving finishes.'
            : 'Navigation is blocked until this transfer finishes or you cancel.'}
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
        !complete && (phase === 'transfer' || (phase === 'preparing' && progress != null))
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
      onClose={() => {
        if (complete) onClose?.();
        else if (!savingLibrary) onCancel();
      }}
    />
  );
}
