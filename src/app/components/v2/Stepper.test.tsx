import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from './index.ts';
import Stepper from './Stepper.tsx';

function renderStepper(
  steps: {
    id: string;
    label: string;
    status: 'pending' | 'current' | 'done' | 'error' | 'skipped';
  }[],
) {
  render(
    <DesignSystemV2Provider>
      <Stepper steps={steps} ariaLabel="Demo" />
    </DesignSystemV2Provider>,
  );
}

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

  it('shows a dash marker and does not number a skipped step', () => {
    renderStepper([
      { id: 'a', label: 'Read', status: 'done' },
      { id: 'b', label: 'Review not needed this time', status: 'skipped' },
      { id: 'c', label: 'Writing', status: 'current' },
    ]);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('data-status', 'skipped');
    expect(items[1].querySelector('[aria-hidden]')).toHaveTextContent('–');
    expect(items[2].querySelector('[aria-hidden]')).toHaveTextContent('2');
  });

  it('numbers only non-skipped steps', () => {
    renderStepper([
      { id: 'a', label: 'What to write', status: 'current' },
      { id: 'b', label: 'Restart & check', status: 'skipped' },
      { id: 'c', label: 'Done', status: 'pending' },
    ]);
    const items = screen.getAllByRole('listitem');
    expect(items[0].querySelector('[aria-hidden]')).toHaveTextContent('1');
    expect(items[2].querySelector('[aria-hidden]')).toHaveTextContent('2');
  });
});
