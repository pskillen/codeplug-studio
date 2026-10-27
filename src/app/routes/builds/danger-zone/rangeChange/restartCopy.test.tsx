import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignSystemV2Provider } from '../../../../components/v2/index.ts';
import CheckStep from './steps/CheckStep.tsx';
import RestartStep from './steps/RestartStep.tsx';
import { DEMO_ACTIONS, RANGE_CHANGE_DEMO_STATES } from './rangeChangeDemo.ts';

const view = (id: string) => RANGE_CHANGE_DEMO_STATES.find((s) => s.id === id)!.view;

/** On hardware the D890's screen stays on "PC Read" after END, so no copy may promise a normal screen. */
describe('restart copy', () => {
  it('step 6 tells the user the screen may stay on PC Read and what to wait for', () => {
    render(
      <DesignSystemV2Provider>
        <RestartStep view={view('restart-verified')} actions={DEMO_ACTIONS} />
      </DesignSystemV2Provider>,
    );
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/may stay on 'PC Read'/);
    expect(text).toMatch(/Reconnect lights up or the countdown ends/);
    expect(text).not.toMatch(/normal screen/i);
  });

  it('step 8 does not promise a normal screen either', () => {
    render(
      <DesignSystemV2Provider>
        <CheckStep view={view('check')} actions={DEMO_ACTIONS} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(/may stay on 'PC Read'/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/normal screen/i);
  });
});
