/**
 * Step 2: connect and read (#1393). The port picker is the browser's; this shows the in-session
 * read (the read every Write already does) and ends with the radio's identity. No decisions here.
 */

import { Progress, Text } from '@mantine/core';
import RadioIoStageList from '../../RadioIoStageList.tsx';
import { Button } from '../../../v2/index.ts';
import { IdentitySection } from '../reviewSections.tsx';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function ConnectReadBody({ config, view }: StepProps) {
  const percent = view.progress?.max
    ? Math.min(100, (100 * view.progress.cur) / view.progress.max)
    : undefined;
  return (
    <div className={classes.stack}>
      <Text size="sm">
        {view.reconnecting
          ? 'Reconnecting: the radio may have left programming mode.'
          : `Connecting to ${config.radioLabel} and reading it…`}
      </Text>
      {view.readRows.length > 0 ? (
        <RadioIoStageList
          rows={view.readRows}
          progress={view.progress}
          startedAt={view.startedAt}
        />
      ) : (
        <div>
          <Progress value={percent ?? 0} animated={percent == null} aria-label="Read progress" />
          {view.progress?.msg ? (
            <Text size="xs" c="dimmed" mt={4}>
              {view.progress.msg}
            </Text>
          ) : null}
        </div>
      )}
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
