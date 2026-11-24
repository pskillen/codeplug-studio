import { act, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import StageProgress from './StageProgress.tsx';
import classes from './StageProgress.module.css';

function renderProgress(props: Partial<ComponentProps<typeof StageProgress>> = {}) {
  const startedAt = props.startedAt ?? Date.now() - 42_000;
  render(
    <DesignSystemV2Provider>
      <StageProgress
        groups={
          props.groups ?? [
            {
              id: 'g',
              rows: [{ id: 'a', label: 'Channels', status: 'active', weight: 100 }],
            },
          ]
        }
        progress={props.progress ?? { cur: 1, max: 10, msg: '' }}
        startedAt={props.startedAt === undefined ? startedAt : props.startedAt}
        running={props.running ?? true}
        {...props}
      />
    </DesignSystemV2Provider>,
  );
}

describe('StageProgress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows elapsed time from the start', () => {
    const t0 = Date.now();
    vi.setSystemTime(t0);
    renderProgress({ startedAt: t0 - 65_000, running: true });
    expect(screen.getByTestId('stage-progress-elapsed')).toHaveTextContent('Elapsed 1:05');
  });

  it('shows the estimate only after two seconds', () => {
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);
    renderProgress({ startedAt: t0, estimateSeconds: 70, running: true });
    expect(screen.queryByTestId('stage-progress-estimate')).toBeNull();
    vi.setSystemTime(t0 + 2500);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('stage-progress-estimate')).toHaveTextContent(/left/);
  });

  it('shows group headings only with two or more groups', () => {
    renderProgress({
      groups: [
        { id: 'w', title: 'Write', rows: [{ id: 'a', label: 'Channels', status: 'pending' }] },
        {
          id: 'r',
          title: 'Restart',
          rows: [{ id: 'b', label: 'Restart wait', status: 'pending' }],
        },
      ],
    });
    expect(screen.getByText('Write')).toBeInTheDocument();
    expect(screen.getByText('Restart')).toBeInTheDocument();
  });

  it('does not show headings with one group', () => {
    renderProgress({
      groups: [
        { id: 'g', title: 'Write', rows: [{ id: 'a', label: 'Channels', status: 'pending' }] },
      ],
    });
    expect(screen.queryByText('Write')).toBeNull();
  });

  it('greys planned rows before they start', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <StageProgress
          groups={[
            {
              id: 'g',
              rows: [
                { id: 'a', label: 'Local info', status: 'pending', weight: 10 },
                { id: 'b', label: 'Channels', status: 'pending', weight: 10 },
              ],
            },
          ]}
          progress={null}
          startedAt={Date.now()}
          running
        />
      </DesignSystemV2Provider>,
    );
    expect(container.querySelector(`.${classes.planPending}`)).toBeTruthy();
  });

  it('grows a list when there is no plan', () => {
    renderProgress({
      groups: [{ id: 'g', rows: [{ id: 'x', label: 'Zones', status: 'active' }] }],
      progress: { cur: 0, max: 0, msg: 'Reading…' },
    });
    expect(screen.getByText('Zones')).toBeInTheDocument();
  });
});
