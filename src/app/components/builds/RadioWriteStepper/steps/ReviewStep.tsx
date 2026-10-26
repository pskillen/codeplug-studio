/**
 * Step 3: review (#1393). Always shown. Sections come from `reviewSectionsFor`; the primary
 * button's label comes from the ticked parts. Cancel writes nothing.
 */

import { Fragment } from 'react';
import { Text } from '@mantine/core';
import { Button } from '../../../v2/index.ts';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';
import { writeButtonLabel } from '../writeParts.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function ReviewBody({ config, view }: StepProps) {
  const review = view.review;
  if (!review) return null;
  return (
    <div className={classes.stack}>
      {review.sections.map((section, i) => (
        <Fragment key={i}>{section}</Fragment>
      ))}
      <Text size="xs" c="dimmed">
        {config.cancelRestartsRadio
          ? `Nothing has been written yet. Cancel writes nothing, but the radio restarts (about ${config.restartWaitSeconds} s).`
          : 'Nothing has been written yet. Cancel leaves the radio as it is.'}
      </Text>
    </div>
  );
}

export function ReviewFooter({ view, actions }: StepProps) {
  return (
    <>
      <Button variant="secondary" size="sm" onClick={actions.onCancelReview}>
        Cancel
      </Button>
      <Button variant="primary" size="sm" onClick={actions.onWrite}>
        {writeButtonLabel(view.parts)}
      </Button>
    </>
  );
}
