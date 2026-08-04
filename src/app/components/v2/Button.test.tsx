import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import Button from './Button.tsx';

describe('Button', () => {
  it('renders variants and sizes', () => {
    render(
      <DesignSystemV2Provider>
        <Button variant="dashed" size="sm">
          Add item
        </Button>
      </DesignSystemV2Provider>,
    );

    const btn = screen.getByRole('button', { name: 'Add item' });
    expect(btn).toHaveAttribute('data-variant', 'dashed');
    expect(btn).toHaveAttribute('data-size', 'sm');
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(
      <DesignSystemV2Provider>
        <Button onClick={onClick}>Save</Button>
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
