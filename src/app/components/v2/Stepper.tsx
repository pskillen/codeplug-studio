import { IconCheck, IconX } from '@tabler/icons-react';

import classes from './Stepper.module.css';

export type StepperStepStatus = 'pending' | 'current' | 'done' | 'error';

export interface StepperStep {
  id: string;
  label: string;
  status: StepperStepStatus;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  className?: string;
}

const STATUS_CLASS: Record<StepperStepStatus, string> = {
  pending: classes.pending,
  current: classes.current,
  done: classes.done,
  error: classes.error,
};

/** Presentational step indicator for multi-step flows (wizards). An ordered list; no navigation of its own. */
export default function Stepper({
  steps,
  orientation = 'horizontal',
  ariaLabel = 'Progress',
  className,
}: StepperProps) {
  const rootClass = [
    classes.root,
    orientation === 'vertical' ? classes.vertical : classes.horizontal,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav aria-label={ariaLabel}>
      <ol className={rootClass}>
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`${classes.step} ${STATUS_CLASS[step.status]}`}
            aria-current={step.status === 'current' ? 'step' : undefined}
            data-status={step.status}
          >
            <span className={classes.marker} aria-hidden>
              {step.status === 'done' ? (
                <IconCheck size={12} stroke={2.5} />
              ) : step.status === 'error' ? (
                <IconX size={12} stroke={2.5} />
              ) : (
                i + 1
              )}
            </span>
            <span className={classes.label}>{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
