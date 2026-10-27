/**
 * The wizard's screen: title, strap, step indicator and the current step. Presentational: the page feeds it the
 * live `view` and `actions`; the styleguide feeds it canned ones.
 */

import type { ReactNode } from 'react';
import { Stepper, type StepperStep } from '../../../../components/v2/index.ts';
import classes from './RangeChange.module.css';
import { COPY, STEP_LABELS } from './rangeChangeCopy.ts';
import BackUpStep from './steps/BackUpStep.tsx';
import ChangeStep from './steps/ChangeStep.tsx';
import CheckStep from './steps/CheckStep.tsx';
import ConfirmStep from './steps/ConfirmStep.tsx';
import DoneStep from './steps/DoneStep.tsx';
import NewRangeStep from './steps/NewRangeStep.tsx';
import ReadStep from './steps/ReadStep.tsx';
import RestartStep from './steps/RestartStep.tsx';
import RestoreStep from './steps/RestoreStep.tsx';
import ResumeStep from './steps/ResumeStep.tsx';
import {
  RANGE_CHANGE_STEPS,
  type RangeChangeActions,
  type RangeChangeStep,
  type RangeChangeView,
} from './types.ts';

type Numbered = (typeof RANGE_CHANGE_STEPS)[number];

function isNumbered(step: RangeChangeStep): step is Numbered {
  return (RANGE_CHANGE_STEPS as readonly string[]).includes(step);
}

function stepStatuses(current: RangeChangeStep): StepperStep[] {
  const index = isNumbered(current) ? RANGE_CHANGE_STEPS.indexOf(current) : -1;
  return RANGE_CHANGE_STEPS.map((id, i) => ({
    id,
    label: STEP_LABELS[id],
    status: current === 'done' ? 'done' : i < index ? 'done' : i === index ? 'current' : 'pending',
  }));
}

export interface RangeChangeScreenProps {
  view: RangeChangeView;
  actions: RangeChangeActions;
  /** Rendered after the shell, inside the page (the leave dialog). */
  children?: ReactNode;
}

export default function RangeChangeScreen({ view, actions, children }: RangeChangeScreenProps) {
  const numbered = isNumbered(view.step);
  const index = isNumbered(view.step) ? RANGE_CHANGE_STEPS.indexOf(view.step) : 0;
  const showSteps = view.step !== 'resume';

  let body: ReactNode = null;
  switch (view.step) {
    case 'read':
      body = <ReadStep view={view} actions={actions} />;
      break;
    case 'newRange':
      body = <NewRangeStep view={view} actions={actions} />;
      break;
    case 'backUp':
      body = <BackUpStep view={view} actions={actions} />;
      break;
    case 'confirm':
      body = <ConfirmStep view={view} actions={actions} />;
      break;
    case 'change':
      body = <ChangeStep view={view} actions={actions} />;
      break;
    case 'restart':
      body = <RestartStep view={view} actions={actions} />;
      break;
    case 'restore':
      body = <RestoreStep view={view} actions={actions} />;
      break;
    case 'check':
      body = <CheckStep view={view} actions={actions} />;
      break;
    case 'done':
      body = <DoneStep view={view} actions={actions} />;
      break;
    case 'resume':
      body = <ResumeStep view={view} actions={actions} />;
      break;
  }

  return (
    <div className={classes.page} data-testid="range-change-page">
      <div className={classes.header}>
        <h1 className={classes.title}>{COPY.title}</h1>
        <p className={classes.strap} role="note">
          {COPY.strap}
        </p>
      </div>
      <div className={classes.shell}>
        {showSteps ? (
          <>
            <div className={classes.rail}>
              <Stepper
                steps={stepStatuses(view.step)}
                orientation="vertical"
                ariaLabel="Change frequency range steps"
              />
            </div>
            {numbered ? (
              <div className={classes.compact} data-testid="range-compact-steps">
                <p className={classes.compactLabel}>
                  {index + 1} of {RANGE_CHANGE_STEPS.length} · {STEP_LABELS[view.step as Numbered]}
                </p>
                <div className={classes.compactBar} aria-hidden>
                  <div
                    className={classes.compactFill}
                    style={{ width: `${((index + 1) / RANGE_CHANGE_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <div className={classes.body}>{body}</div>
      </div>
      {children}
    </div>
  );
}
