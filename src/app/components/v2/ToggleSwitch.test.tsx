import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import ToggleSwitch from './ToggleSwitch.tsx';

describe('ToggleSwitch', () => {
  it('toggles via click', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <ToggleSwitch checked={false} onChange={onChange} label="Skip scan" />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
