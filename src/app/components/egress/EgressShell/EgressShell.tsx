import { Text } from '@mantine/core';
import type { ReactNode } from 'react';
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
  const header = egressStepHeaderLabel(steps);
  const stepperSteps = steps.map((s) => ({ id: s.id, label: s.label, status: s.status }));

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      dismissible={dismissible}
      footer={footer}
    >
      {header ? (
        <Text className={classes.headerLine} data-testid="egress-step-label">
          {header}
        </Text>
      ) : null}
      <Stepper className={classes.stepper} ariaLabel="Write steps" steps={stepperSteps} />
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
