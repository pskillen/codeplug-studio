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

describe('DoneStep usage changes', () => {
  it('shows the informational line only when something changed through use', () => {
    const { rerender } = render(
      <DesignSystemV2Provider>
        <DoneStep view={done} actions={DEMO_ACTIONS} />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByTestId('range-usage-changes')).toBeNull();
    rerender(
      <DesignSystemV2Provider>
        <DoneStep
          view={{ ...done, done: { ...done.done, usageChanges: ['current channel (Zone A)'] } }}
          actions={DEMO_ACTIONS}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByTestId('range-usage-changes')).toHaveTextContent(
      "Changed since the restore, which is normal if you've used the radio: current channel (Zone A).",
    );
  });
});
