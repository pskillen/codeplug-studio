/**
 * Write stepper (#1393, workflow design §2): one dialog for the whole Write.
 * What to write → Read → Review → Writing → Restart & check → Done.
 *
 * Presentational: `useRadioWriteFlow` owns the state machine and the services and hands this
 * component a view plus actions. Step bodies live in `steps/`.
 */

import { useState, type ReactNode } from 'react';
import { Text } from '@mantine/core';
import { EgressShell, ErrorPanel } from '../../egress/index.ts';
import { Button } from '../../v2/index.ts';
import classes from './RadioWriteStepper.module.css';
import { type WriteFlowActions, type WriteFlowView, type WriteStepperConfig } from './types.ts';
import { writeSteps } from './writeSteps.ts';
import { WhatToWriteBody, WhatToWriteFooter } from './steps/WhatToWriteStep.tsx';
import { ConnectBody, ConnectFooter } from './steps/ConnectStep.tsx';
import { ConnectReadBody, ConnectReadFooter } from './steps/ConnectReadStep.tsx';
import { ReviewBody, ReviewFooter } from './steps/ReviewStep.tsx';
import { WritingBody, WritingFooter } from './steps/WritingStep.tsx';
import { RestartCheckBody, RestartCheckFooter } from './steps/RestartCheckStep.tsx';
import { DoneBody, DoneFooter } from './steps/DoneStep.tsx';

export interface RadioWriteStepperProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

/** Lifts the D890 pending-units block for an operator who rewrote the radio some other way. */
function PendingWarningClear({
  warning,
  onClear,
}: {
  warning: NonNullable<WriteFlowView['pendingWarning']>;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const since = warning.recordedAt
    ? ` (recorded ${warning.recordedAt.slice(0, 16).replace('T', ' ')} UTC)`
    : '';
  return (
    <div style={{ marginTop: 8 }} data-testid="write-stepper-pending-clear">
      {confirming ? (
        <>
          <Text size="sm" mb={4}>
            Clear the warning{since}? Do this only if the radio has since been fully rewritten, by
            the CPS or by Studio. Otherwise the next write will commit the unfinished parts of the
            interrupted one.
          </Text>
          <Button size="sm" variant="secondary" onClick={onClear}>
            Yes, I have rewritten this radio
          </Button>{' '}
          <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
            Keep the warning
          </Button>
        </>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          I have rewritten this radio: clear warning
        </Button>
      )}
    </div>
  );
}

export default function RadioWriteStepper({ config, view, actions }: RadioWriteStepperProps) {
  const props = { config, view, actions };
  let body: ReactNode = null;
  let footer: ReactNode = null;
  switch (view.step) {
    case 'whatToWrite':
      body = <WhatToWriteBody {...props} />;
      footer = <WhatToWriteFooter {...props} />;
      break;
    case 'connect':
      body = <ConnectBody {...props} />;
      footer = <ConnectFooter {...props} />;
      break;
    case 'connectRead':
      body = <ConnectReadBody {...props} />;
      footer = <ConnectReadFooter {...props} />;
      break;
    case 'review':
      body = <ReviewBody {...props} />;
      footer = <ReviewFooter {...props} />;
      break;
    case 'writing':
      body = <WritingBody {...props} />;
      footer = <WritingFooter {...props} />;
      break;
    case 'restartCheck':
      body = <RestartCheckBody {...props} />;
      footer = <RestartCheckFooter {...props} />;
      break;
    case 'done':
      body = <DoneBody {...props} />;
      footer = <DoneFooter {...props} />;
      break;
  }

  const wayOut =
    view.errorOutcome && (view.pendingWarning || view.retryLabel === null) ? (
      <>
        {view.pendingWarning ? (
          <PendingWarningClear
            warning={view.pendingWarning}
            onClear={actions.onClearPendingWarning}
          />
        ) : null}
        {view.pendingWarning && view.retryLabel === null ? (
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={actions.onChangeTicks}>
              Change the ticks
            </Button>
          </div>
        ) : null}
      </>
    ) : view.pendingWarning ? (
      <PendingWarningClear warning={view.pendingWarning} onClear={actions.onClearPendingWarning} />
    ) : null;

  const notice =
    view.notice && view.step === 'whatToWrite' ? <Text size="sm">{view.notice}</Text> : null;

  return (
    <EgressShell
      open={view.open}
      onClose={actions.onClose}
      title={`Write radio · ${config.options.radioLabel}`}
      dismissible={!view.busy}
      steps={writeSteps(view, config.options)}
      busy={view.busy}
      error={
        view.errorOutcome ? (
          <ErrorPanel
            testId="write-stepper-error"
            outcome={view.errorOutcome}
            retryLabel={view.retryLabel}
            onRetry={actions.onRetry}
            wayOut={wayOut}
          />
        ) : null
      }
      notice={notice}
      footer={footer}
    >
      <div className={classes.stack}>{body}</div>
    </EgressShell>
  );
}
