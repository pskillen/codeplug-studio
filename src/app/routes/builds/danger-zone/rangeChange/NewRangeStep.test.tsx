import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignSystemV2Provider } from '../../../../components/v2/index.ts';
import NewRangeStep from './steps/NewRangeStep.tsx';
import { DEMO_ACTIONS, RANGE_CHANGE_DEMO_STATES } from './rangeChangeDemo.ts';

describe('NewRangeStep', () => {
  it('keeps the current range ticked (and disabled) when another range is picked', () => {
    const view = RANGE_CHANGE_DEMO_STATES.find((s) => s.id === 'new-range')!.view;
    expect(view.target).toBe(7);
    render(
      <DesignSystemV2Provider>
        <NewRangeStep view={view} actions={DEMO_ACTIONS} />
      </DesignSystemV2Provider>,
    );
    const current = screen.getByTestId('range-current-tick') as HTMLInputElement;
    expect(current.checked).toBe(true);
    expect(current.disabled).toBe(true);
    const picked = screen.getByRole('radio', { checked: true });
    expect(picked).toHaveAttribute('id', 'range-7');
  });
});
