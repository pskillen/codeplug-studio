import { Progress } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconLoader2,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from './Button.tsx';
import ModalShell from './ModalShell.tsx';
import classes from './ProgressModal.module.css';

export type ProgressModalPhase = 'running' | 'finished';
export type ProgressModalStepStatus = 'pending' | 'active' | 'success' | 'error';

export interface ProgressModalStep {
  id: string;
  label: ReactNode;
  detail?: ReactNode;
  status: ProgressModalStepStatus;
}

export interface ProgressModalProps {
  open: boolean;
  title?: ReactNode;
  phase: ProgressModalPhase;
  steps: ProgressModalStep[];
  /** 0-100, shown as a progress bar when provided. */
  progress?: number;
  /** Shown only while `phase === 'running'`. */
  note?: ReactNode;
  /** Shown only once `phase !== 'running'`. */
  summary?: ReactNode;
  onClose: () => void;
  onRetry?: () => void;
  /** When set, replaces the default finished footer (and running cancel is omitted). */
  footer?: ReactNode;
  inline?: boolean;
}

const STEP_ICON: Record<ProgressModalStepStatus, ReactNode> = {
  pending: <IconCircleDashed size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  active: <IconLoader2 size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  success: <IconCircleCheck size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  error: <IconCircleX size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
};

const STEP_ICON_CLASS: Record<ProgressModalStepStatus, string> = {
  pending: classes.stepIconPending,
  active: classes.stepIconActive,
  success: classes.stepIconSuccess,
  error: classes.stepIconError,
};

/**
 * Blocking progress modal with per-step status — the intended shape for radio
 * write/verify flows (#924). Not dismissible while `phase === 'running'`.
 */
export default function ProgressModal({
  open,
  title = 'Writing to radio',
  phase,
  steps,
  progress,
  note = 'Do not disconnect the radio while this is running.',
  summary,
  onClose,
  onRetry,
  footer,
  inline,
}: ProgressModalProps) {
  const running = phase === 'running';
  const hasError = steps.some((step) => step.status === 'error');

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      icon={
        !running && hasError ? (
          <IconAlertTriangle size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
        ) : undefined
      }
      iconTone={hasError ? 'destructive' : 'accent'}
      dismissible={!running}
      inline={inline}
      footer={
        footer ??
        (running ? undefined : (
          <>
            {hasError && onRetry ? (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          </>
        ))
      }
    >
      {progress != null ? (
        <Progress value={progress} size="sm" className={classes.progressBar} />
      ) : null}
      <ul className={classes.steps}>
        {steps.map((step) => (
          <li key={step.id} className={classes.step}>
            <span
              className={[classes.stepIcon, STEP_ICON_CLASS[step.status]].join(' ')}
              aria-hidden
            >
              {STEP_ICON[step.status]}
            </span>
            <span className={classes.stepCopy}>
              <span className={classes.stepLabel}>{step.label}</span>
              {step.detail ? <span className={classes.stepDetail}>{step.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {running && note ? <p className={classes.note}>{note}</p> : null}
      {!running && summary ? <div className={classes.summary}>{summary}</div> : null}
    </ModalShell>
  );
}
