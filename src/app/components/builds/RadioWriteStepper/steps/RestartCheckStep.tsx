/**
 * Step 5: restart and check (#1393). Waits for a radio that restarts after END, then offers the
 * optional Check write and, when keps could not share the codeplug's session, the keps write.
 */

import { Alert, Text } from '@mantine/core';
import RestartCountdown from '../../../radio-io/RestartCountdown.tsx';
import { StageProgress } from '../../../egress/index.ts';
import { Button } from '../../../v2/index.ts';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function RestartCheckBody({ config, view }: StepProps) {
  const groups: { id: string; title?: string; rows: typeof view.writeRows }[] = [];
  if (config.options.restartAfterEndSeconds > 0) {
    groups.push({
      id: 'restart',
      title: 'Restart',
      rows: [
        {
          id: 'restart-wait',
          label:
            view.restartSecondsLeft > 0
              ? `Waiting (${view.restartSecondsLeft} s left)`
              : 'Radio is back',
          status: view.restartSecondsLeft > 0 ? 'active' : 'success',
          coarse: true,
        },
      ],
    });
  }
  if (view.checkStatus === 'running') {
    groups.push({
      id: 'check',
      title: 'Check write',
      rows: view.writeRows.length > 0 ? view.writeRows : [{ id: 'check', label: 'Check write', status: 'active' }],
    });
  }
  if (view.kepsAfterRestart === 'running') {
    groups.push({
      id: 'keps',
      title: 'Keps after restart',
      rows:
        view.writeRows.length > 0
          ? view.writeRows
          : [{ id: 'keps', label: 'Writing satellite keps', status: 'active' }],
    });
  }

  return (
    <div className={classes.stack}>
      <Text size="sm" fw={600}>
        {config.radioLabel}: transfer finished.
      </Text>
      <RestartCountdown
        secondsLeft={view.restartSecondsLeft}
        totalSeconds={config.options.restartAfterEndSeconds}
        data-testid="write-stepper-restart-wait"
      />
      {view.kepsFailure ? (
        <Alert color="yellow" title="Codeplug written, satellite keps not written">
          <Text size="sm" data-testid="write-stepper-keps-failure">
            The codeplug is on the radio. The satellite keps were not written ({view.kepsFailure}).
          </Text>
        </Alert>
      ) : null}
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
      {groups.length > 0 ? (
        <StageProgress
          testId="write-stepper-restart-progress"
          groups={groups}
          progress={view.progress}
          startedAt={
            view.checkStatus === 'running'
              ? view.checkStartedAt
              : view.kepsAfterRestart === 'running'
                ? view.writeStartedAt
                : view.readStartedAt
          }
          running={view.busy}
        />
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
        {view.kepsAfterRestart === 'pending'
          ? 'Finish without keps'
          : view.checkStatus === 'available'
            ? 'Skip and finish'
            : 'Finish'}
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