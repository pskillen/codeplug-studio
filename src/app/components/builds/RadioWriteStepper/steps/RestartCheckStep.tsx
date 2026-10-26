/**
 * Step 5: restart and check (#1393). Waits for a radio that restarts after END, then offers the
 * optional Check write and, when keps could not share the codeplug's session, the keps write.
 */

import { Progress, Text } from '@mantine/core';
import { Button } from '../../../v2/index.ts';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function RestartCheckBody({ config, view }: StepProps) {
  const waiting = view.restartSecondsLeft > 0;
  const percent = view.progress?.max
    ? Math.min(100, (100 * view.progress.cur) / view.progress.max)
    : undefined;
  return (
    <div className={classes.stack}>
      <Text size="sm" fw={600}>
        {config.radioLabel}: transfer finished.
      </Text>
      {waiting ? (
        <Text size="sm" data-testid="write-stepper-restart-wait">
          Waiting for the radio to restart (about {config.restartWaitSeconds} s):{' '}
          {view.restartSecondsLeft} s
        </Text>
      ) : (
        <Text size="sm">Wait until the radio shows its normal screen, then continue.</Text>
      )}
      {view.checkStatus === 'available' ? (
        <Text size="sm" c="dimmed">
          Check write reads the radio back and compares it with what was sent. It is optional.
        </Text>
      ) : null}
      {view.kepsAfterRestart === 'pending' || view.kepsAfterRestart === 'running' ? (
        <Text size="sm" c="dimmed">
          Satellite keps are written in a new session once the radio is back.
        </Text>
      ) : null}
      {view.busy ? (
        <div>
          <Progress value={percent ?? 0} animated={percent == null} aria-label="Progress" />
          {view.progress?.msg ? (
            <Text size="xs" c="dimmed" mt={4}>
              {view.progress.msg}
            </Text>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RestartCheckFooter({ view, actions }: StepProps) {
  const waiting = view.restartSecondsLeft > 0;
  if (view.busy) {
    return (
      <Button variant="secondary" size="sm" onClick={actions.onAbort}>
        Cancel
      </Button>
    );
  }
  return (
    <>
      <Button variant="secondary" size="sm" onClick={actions.onSkipCheck}>
        {view.checkStatus === 'available' ? 'Skip and finish' : 'Finish'}
      </Button>
      {view.kepsAfterRestart === 'pending' ? (
        <Button
          variant="primary"
          size="sm"
          disabled={waiting}
          onClick={actions.onWriteKepsAfterRestart}
        >
          Write keps
        </Button>
      ) : null}
      {view.checkStatus === 'available' ? (
        <Button variant="primary" size="sm" disabled={waiting} onClick={actions.onCheckWrite}>
          Check write
        </Button>
      ) : null}
    </>
  );
}
