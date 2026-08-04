import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import Checkbox from './Checkbox.tsx';

describe('Checkbox', () => {
  it('calls onCheckedChange', () => {
    const onCheckedChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <Checkbox checked={false} onCheckedChange={onCheckedChange} aria-label="Select row" />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
