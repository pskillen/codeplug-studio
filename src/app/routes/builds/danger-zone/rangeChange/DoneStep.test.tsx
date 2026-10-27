import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignSystemV2Provider } from '../../../../components/v2/index.ts';
import DoneStep from './steps/DoneStep.tsx';
import { DEMO_ACTIONS, RANGE_CHANGE_DEMO_STATES } from './rangeChangeDemo.ts';

const done = RANGE_CHANGE_DEMO_STATES.find((s) => s.id === 'done')!.view;

function renderDone(calibrationChecked: boolean) {
  render(
    <DesignSystemV2Provider>
      <DoneStep
        view={{ ...done, done: { ...done.done, calibrationChecked } }}
        actions={DEMO_ACTIONS}
      />
    </DesignSystemV2Provider>,
  );
}

describe('DoneStep calibration line', () => {
  it('says "checked unchanged" only when it was compared', () => {
    renderDone(true);
    expect(screen.getByText(/checked unchanged/)).toBeInTheDocument();
  });

  it('says it was not compared otherwise', () => {
    renderDone(false);
    expect(screen.queryByText(/checked unchanged/)).toBeNull();
    expect(screen.getByText(/did not compare it/)).toBeInTheDocument();
  });
});
