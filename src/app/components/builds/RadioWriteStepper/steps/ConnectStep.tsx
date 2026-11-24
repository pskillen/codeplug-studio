import { Text } from '@mantine/core';
import { PreflightCard } from '../../../egress/index.ts';
import { Button } from '../../../v2/index.ts';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function ConnectBody({ config, view }: StepProps) {
  const label = config.options.radioLabel;
  const preflight = view.preflight;
  const cardStatus =
    view.errorOutcome && view.step === 'connect' && preflight.status !== 'checking'
      ? 'refused'
      : preflight.status;
  return (
    <div>
      <Text size="sm" mb="sm">
        Connecting to {label}…
      </Text>
      <PreflightCard
        status={cardStatus}
        identity={preflight.identity}
        rows={preflight.rows}
        testId="write-connect-preflight"
      />
    </div>
  );
}

export function ConnectFooter({ actions }: StepProps) {
  return (
    <Button variant="secondary" size="sm" onClick={actions.onAbort}>
      Cancel
    </Button>
  );
}
