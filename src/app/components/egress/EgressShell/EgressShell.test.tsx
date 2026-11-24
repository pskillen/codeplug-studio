import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import EgressShell, { type EgressStep } from './EgressShell.tsx';

function renderShell(steps: readonly EgressStep[], props: { busy?: boolean } = {}) {
  render(
    <DesignSystemV2Provider>
      <EgressShell
        open
        title="Write radio · AT-D890UV"
        onClose={() => undefined}
        dismissible
        steps={steps}
        busy={props.busy ?? false}
        footer={<button type="button">OK</button>}
      >
        <p>Body</p>
      </EgressShell>
    </DesignSystemV2Provider>,
  );
}

describe('EgressShell', () => {
  it('counts only steps that are not skipped', () => {
    const steps: EgressStep[] = [
      { id: 'a', label: 'What to write', status: 'done' },
      { id: 'b', label: 'Read', status: 'current' },
      { id: 'c', label: 'Review not needed this time', status: 'skipped' },
      { id: 'd', label: 'Writing', status: 'pending' },
      { id: 'e', label: 'Restart & check', status: 'skipped' },
      { id: 'f', label: 'Done', status: 'pending' },
    ];
    renderShell(steps);
    expect(screen.getByTestId('egress-step-label')).toHaveTextContent('2 of 4 · Read');
  });

  it('shows the current step label as n of m', () => {
    const steps: EgressStep[] = [
      { id: 'a', label: 'What to write', status: 'done' },
      { id: 'b', label: 'Read', status: 'done' },
      { id: 'c', label: 'Writing', status: 'current' },
      { id: 'd', label: 'Done', status: 'pending' },
    ];
    renderShell(steps);
    expect(screen.getByTestId('egress-step-label')).toHaveTextContent('3 of 4 · Writing');
  });

  it('shows the keep-screen-on hint while busy', () => {
    renderShell([{ id: 'a', label: 'Read', status: 'current' }], { busy: true });
    expect(screen.getByTestId('keep-screen-on-hint')).toBeInTheDocument();
  });
});
