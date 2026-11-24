import type { EgressStep, EgressStepStatus } from '../../egress/EgressShell/EgressShell.tsx';
import type { WriteShellOptions } from '../../../services/egress/writeShellOptions.ts';
import type { RestoreFlowView, RestoreStep } from './useRadioRestoreFlow.ts';

export const RESTORE_STEPS: readonly RestoreStep[] = [
  'connect',
  'review',
  'restoring',
  'restart',
  'done',
];

const RESTORE_STEP_LABEL: Record<RestoreStep, string> = {
  connect: 'Connect',
  review: 'Review',
  restoring: 'Restoring',
  restart: 'Restart',
  done: 'Done',
};

function stepIndex(step: RestoreStep): number {
  return RESTORE_STEPS.indexOf(step);
}

function baseStatus(
  id: RestoreStep,
  current: RestoreStep,
  errorStep: RestoreStep | null,
): EgressStepStatus {
  if (errorStep && id === errorStep) return 'error';
  const idx = stepIndex(id);
  const cur = stepIndex(current);
  if (idx < cur) return 'done';
  if (idx === cur) return 'current';
  return 'pending';
}

/** Steps for the Restore dialog step bar. */
export function restoreSteps(view: RestoreFlowView, options: WriteShellOptions): EgressStep[] {
  const errorStep = view.errorOutcome ? view.step : null;
  const restartRuns = options.restartAfterEndSeconds > 0;

  return RESTORE_STEPS.map((id) => {
    if (id === 'restart' && !restartRuns) {
      return { id, label: RESTORE_STEP_LABEL.restart, status: 'skipped' as const };
    }
    return { id, label: RESTORE_STEP_LABEL[id], status: baseStatus(id, view.step, errorStep) };
  });
}
