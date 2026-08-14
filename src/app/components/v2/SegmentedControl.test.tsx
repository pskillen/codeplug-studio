import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import SegmentedControl from './SegmentedControl.tsx';

describe('SegmentedControl', () => {
  it('calls onChange with selected value', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <SegmentedControl
          options={[
            { value: 'ts1', label: 'TS1' },
            { value: 'ts2', label: 'TS2' },
          ]}
          value="ts1"
          onChange={onChange}
        />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'TS2' }));
    expect(onChange).toHaveBeenCalledWith('ts2');
  });

  it('names the group when aria-label is set', () => {
    render(
      <DesignSystemV2Provider>
        <SegmentedControl
          options={[
            { value: 'ts1', label: 'TS1' },
            { value: 'ts2', label: 'TS2' },
          ]}
          value="ts1"
          aria-label="Timeslot"
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('group', { name: 'Timeslot' })).toBeInTheDocument();
  });
});
