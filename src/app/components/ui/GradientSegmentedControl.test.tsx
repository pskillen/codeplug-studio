import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
} from './GradientSegmentedControl.tsx';

const DATA = [
  { value: 'allow', label: 'Allow TX' },
  { value: 'forbid', label: 'RX only' },
] as const;

function renderControl(
  props: Partial<ComponentProps<typeof GradientSegmentedControl>> & {
    value: string;
    onChange: (value: string) => void;
  },
) {
  return render(
    <MantineProvider>
      <GradientSegmentedControl data={[...DATA]} scheme="allowForbid" {...props} />
    </MantineProvider>,
  );
}

describe('GradientSegmentedControl', () => {
  it('emits the idle value when No change is clicked', () => {
    const onChange = vi.fn();
    renderControl({
      value: 'allow',
      onChange,
      idleOption: { value: GRADIENT_SEGMENT_IDLE_VALUE, label: 'No change' },
    });

    fireEvent.click(screen.getByRole('radio', { name: 'No change' }));
    expect(onChange).toHaveBeenCalledWith(GRADIENT_SEGMENT_IDLE_VALUE);
  });

  it('does not treat a shared-value hint as the selected option', () => {
    const onChange = vi.fn();
    renderControl({
      value: GRADIENT_SEGMENT_IDLE_VALUE,
      onChange,
      idleOption: { value: GRADIENT_SEGMENT_IDLE_VALUE, label: 'No change' },
      sharedValue: 'allow',
    });

    expect(screen.getByRole('radio', { name: 'No change' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Allow TX' })).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });
});
