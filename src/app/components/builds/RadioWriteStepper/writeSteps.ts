import type { EgressStep, EgressStepStatus } from '../../egress/EgressShell/EgressShell.tsx';
import type { WriteShellOptions } from '../../../services/egress/writeShellOptions.ts';
import { WRITE_STEPS, WRITE_STEP_LABEL, type WriteFlowView, type WriteStep } from './types.ts';

function stepIndex(step: WriteStep): number {
  return WRITE_STEPS.indexOf(step);
}

function baseStatus(
  id: WriteStep,
  current: WriteStep,
  errorStep: WriteStep | null,
): EgressStepStatus {
  if (errorStep && id === errorStep) return 'error';
  const idx = stepIndex(id);
  const cur = stepIndex(current);
  if (idx < cur) return 'done';
  if (idx === cur) return 'current';
  return 'pending';
}

function restartStepRuns(view: WriteFlowView, options: WriteShellOptions): boolean {
  return (
    options.restartAfterEndSeconds > 0 ||
    options.check.available ||
    Boolean(view.parts.keps && options.keps?.session === 'after-restart')
  );
}

/** Steps for the Write dialog step bar; skipped steps are not counted in the shell header. */
export function writeSteps(view: WriteFlowView, options: WriteShellOptions): EgressStep[] {
  const errorStep = view.errorOutcome ? view.step : null;
  const restartRuns = restartStepRuns(view, options);

  return WRITE_STEPS.map((id) => {
    if (id === 'review') {
      if (view.reviewDecision === 'skipped') {
        return {
          id,
          label: 'Review not needed this time',
          status: 'skipped' as const,
        };
      }
      const label =
        view.reviewDecision === 'undecided' ? 'Review if needed' : WRITE_STEP_LABEL.review;
      return { id, label, status: baseStatus(id, view.step, errorStep) };
    }
    if (id === 'restartCheck' && !restartRuns) {
      return { id, label: WRITE_STEP_LABEL.restartCheck, status: 'skipped' as const };
    }
    return { id, label: WRITE_STEP_LABEL[id], status: baseStatus(id, view.step, errorStep) };
  });
}
