import { Progress, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { ReactNode } from 'react';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../../lib/breakpoints.ts';
import { KEEP_SCREEN_ON_HINT, useScreenWakeLock } from '../../../hooks/useScreenWakeLock.ts';
import { ModalShell } from '../../v2/index.ts';
import Stepper from '../../v2/Stepper.tsx';
import { egressStepHeaderLabel } from './egressStepLabel.ts';
import classes from './EgressShell.module.css';

export type EgressStepStatus = 'pending' | 'current' | 'done' | 'error' | 'skipped';

export interface EgressStep {
  id: string;
  label: string;
  status: EgressStepStatus;
}

export interface EgressShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** False while a transfer runs (no close on overlay or Escape). */
  dismissible: boolean;
  steps: readonly EgressStep[];
  /** Shows the keep-screen-on hint while true and the screen lock is not held. */
  busy: boolean;
  /** ErrorPanel (or nothing); rendered above the body. */
  error?: ReactNode;
  /** A plain line above the body (quiet returns). */
  notice?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

/** Shared modal frame for export and write dialogs: step header, v2 Stepper, error, notice, body. */
export default function EgressShell({
  open,
  title,
  onClose,
  dismissible,
  steps,
  busy,
  error,
  notice,
  footer,
  children,
}: EgressShellProps) {
  const { held: screenHeld } = useScreenWakeLock(open && busy);
  // Phones: full screen, and the step list collapses to the header line plus a thin bar.
  const compact = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY) ?? false;
  const header = egressStepHeaderLabel(steps);
  const stepperSteps = steps.map((s) => ({ id: s.id, label: s.label, status: s.status }));
  // Same count as the header line ("3 of 7"): skipped steps don't count.
  const counted = steps.filter((s) => s.status !== 'skipped');
  const at = counted.findIndex((s) => s.status === 'current' || s.status === 'error');
  const stepFraction = counted.length > 0 ? (Math.max(at, 0) + 1) / counted.length : 0;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      fullScreen={compact}
      dismissible={dismissible}
      footer={footer}
    >
      {header ? (
        <Text className={classes.headerLine} data-testid="egress-step-label">
          {header}
        </Text>
      ) : null}
      {compact ? (
        <Progress
          className={classes.stepBar}
          value={Math.min(100, Math.round(stepFraction * 100))}
          size={3}
          aria-label="Step progress"
          data-testid="egress-step-bar"
        />
      ) : (
        <Stepper className={classes.stepper} ariaLabel="Write steps" steps={stepperSteps} />
      )}
      {error}
      {notice ? <div className={classes.notice}>{notice}</div> : null}
      {busy && !screenHeld ? (
        <Text className={classes.hint} data-testid="keep-screen-on-hint">
          {KEEP_SCREEN_ON_HINT}
        </Text>
      ) : null}
      {children}
    </ModalShell>
  );
}
