/**
 * Step 4: writing (#1393). The full planned list, an overall bar and time remaining. Abort stops
 * the transfer (no END is sent by the abort itself).
 */

import { Text } from '@mantine/core';
import { StageProgress } from '../../../egress/index.ts';
import { Button } from '../../../v2/index.ts';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function WritingBody({ view }: StepProps) {
  return (
    <div className={classes.stack}>
      <StageProgress
        testId="write-stepper-write-progress"
        groups={[{ id: 'write', rows: view.writeRows }]}
        progress={view.progress}
        startedAt={view.writeStartedAt}
        estimateSeconds={view.review?.estimateSeconds ?? null}
        running={view.busy}
      />
      <Text size="xs" c="dimmed">
        Keep this tab open until the transfer finishes or you cancel.
      </Text>
    </div>
  );
}

export function WritingFooter({ view, actions }: StepProps) {
  return view.errorOutcome ? (
    <Button variant="secondary" size="sm" onClick={actions.onClose}>
      Close
    </Button>
  ) : (
    <Button variant="secondary" size="sm" onClick={actions.onAbort} disabled={!view.busy}>
      Cancel
    </Button>
  );
}