import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import Stepper from './Stepper.tsx';

describe('Stepper', () => {
  it('renders an ordered list with the current step marked', () => {
    render(
      <DesignSystemV2Provider>
        <Stepper
          ariaLabel="Flash steps"
          steps={[
            { id: 'a', label: 'Radio', status: 'done' },
            { id: 'b', label: 'Firmware', status: 'current' },
            { id: 'c', label: 'Flash', status: 'pending' },
          ]}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('navigation', { name: 'Flash steps' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[2]).toHaveTextContent('3');
  });

  it('marks error steps', () => {
    render(
      <DesignSystemV2Provider>
        <Stepper orientation="vertical" steps={[{ id: 'a', label: 'Flash', status: 'error' }]} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('listitem')).toHaveAttribute('data-status', 'error');
  });
});
