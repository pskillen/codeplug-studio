/**
 * Step 2: connect and read (#1393). The port picker is the browser's; this shows the in-session
 * read (the read every Write already does) and ends with the radio's identity. No decisions here.
 */

import { Text } from '@mantine/core';
import { StageProgress } from '../../../egress/index.ts';
import { Button } from '../../../v2/index.ts';
import { IdentitySection } from '../reviewSectionParts.tsx';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function ConnectReadBody({ config, view }: StepProps) {
  return (
    <div className={classes.stack}>
      <StageProgress
        testId="write-stepper-read-progress"
        lead={
          <Text size="sm">
            {view.reconnecting
              ? 'Reconnecting: the radio may have left programming mode.'
              : `Connecting to ${config.radioLabel} and reading it…`}
          </Text>
        }
        groups={[{ id: 'read', rows: view.readRows }]}
        progress={view.progress}
        startedAt={view.readStartedAt}
        running={view.busy}
      />
      {view.identity ? <IdentitySection identity={view.identity} /> : null}
      <Text size="xs" c="dimmed">
        Keep this tab open until the read finishes or you cancel.
      </Text>
    </div>
  );
}

export function ConnectReadFooter({ view, actions }: StepProps) {
  return (
    <Button variant="secondary" size="sm" onClick={view.busy ? actions.onAbort : actions.onClose}>
      Cancel
    </Button>
  );
}