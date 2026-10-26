/**
 * Write stepper (#1393, workflow design §2): one dialog for the whole Write.
 * What to write → Read → Review → Writing → Restart & check → Done.
 *
 * Presentational: `useRadioWriteFlow` owns the state machine and the services and hands this
 * component a view plus actions. Step bodies live in `steps/`.
 */

import type { ReactNode } from 'react';
import { Alert, Text } from '@mantine/core';
import { ModalShell } from '../../v2/index.ts';
import classes from './RadioWriteStepper.module.css';
import {
  WRITE_STEPS,
  stepBarLabel,
  type WriteFlowActions,
  type WriteFlowView,
  type WriteStepperConfig,
} from './types.ts';
import { WhatToWriteBody, WhatToWriteFooter } from './steps/WhatToWriteStep.tsx';
import { ConnectReadBody, ConnectReadFooter } from './steps/ConnectReadStep.tsx';
import { ReviewBody, ReviewFooter } from './steps/ReviewStep.tsx';
import { Button } from '../../v2/index.ts';

export interface RadioWriteStepperProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

function StepBar({ step }: { step: WriteFlowView['step'] }) {
  const index = WRITE_STEPS.indexOf(step);
  return (
    <div className={classes.stepBar}>
      <Text className={classes.stepBarLabel} data-testid="write-stepper-step-label">
        {stepBarLabel(step)}
      </Text>
      <div className={classes.stepDots} aria-hidden>
        {WRITE_STEPS.map((s, i) => (
          <span
            key={s}
            className={[
              classes.stepDot,
              i < index ? classes.stepDotDone : '',
              i === index ? classes.stepDotCurrent : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
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
    case 'connectRead':
      body = <ConnectReadBody {...props} />;
      footer = <ConnectReadFooter {...props} />;
      break;
    case 'review':
      body = <ReviewBody {...props} />;
      footer = <ReviewFooter {...props} />;
      break;
    default:
      break;
  }

  return (
    <ModalShell
      open={view.open}
      onClose={actions.onClose}
      title={`Write radio · ${config.radioLabel}`}
      size="md"
      dismissible={!view.busy}
      footer={footer}
    >
      <StepBar step={view.step} />
      {view.error ? (
        <Alert color="red" mb="sm" data-testid="write-stepper-error">
          {view.error}
          {view.canReconnect ? (
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary" size="sm" onClick={actions.onReconnect}>
                Reconnect and read again
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}
      {body}
    </ModalShell>
  );
}
