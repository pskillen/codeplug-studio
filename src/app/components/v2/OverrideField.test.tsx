import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import OverrideField from './OverrideField.tsx';

describe('OverrideField', () => {
  it('shows library-default state', () => {
    const onOverride = vi.fn();
    render(
      <DesignSystemV2Provider>
        <OverrideField label="Wire name" overridden={false} onOverride={onOverride} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('using library default')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Override for this build' }));
    expect(onOverride).toHaveBeenCalledOnce();
  });

  it('shows overridden state with reset', () => {
    const onReset = vi.fn();
    render(
      <DesignSystemV2Provider>
        <OverrideField label="Wire name" overridden onReset={onReset}>
          <input aria-label="Wire name value" />
        </OverrideField>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Overridden for this build')).toBeInTheDocument();
    expect(screen.getByLabelText('Wire name value')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
