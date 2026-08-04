import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import Pill from './Pill.tsx';

describe('Pill extensions', () => {
  it('renders dashed add chip as button when onClick provided', () => {
    const onClick = vi.fn();
    render(
      <DesignSystemV2Provider>
        <Pill tone="dashed" onClick={onClick}>+ Add to zone</Pill>
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Add to zone' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders remove control', () => {
    const onRemove = vi.fn();
    render(
      <DesignSystemV2Provider>
        <Pill tone="neutral" onRemove={onRemove}>Zone A</Pill>
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
