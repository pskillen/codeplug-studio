import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import ProgressModal, { type ProgressModalStep } from './ProgressModal.tsx';

const RUNNING_STEPS: ProgressModalStep[] = [
  { id: 'connect', label: 'Connect', status: 'success' },
  { id: 'write', label: 'Write', status: 'active' },
  { id: 'verify', label: 'Verify', status: 'pending' },
];

const FINISHED_ERROR_STEPS: ProgressModalStep[] = [
  { id: 'connect', label: 'Connect', status: 'success' },
  { id: 'write', label: 'Write', status: 'error', detail: 'Channel 12 failed' },
];

describe('ProgressModal', () => {
  it('hides the footer and dismiss control while running', () => {
    render(
      <DesignSystemV2Provider>
        <ProgressModal open phase="running" steps={RUNNING_STEPS} onClose={() => undefined} />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('shows the running note while running', () => {
    render(
      <DesignSystemV2Provider>
        <ProgressModal open phase="running" steps={RUNNING_STEPS} onClose={() => undefined} />
      </DesignSystemV2Provider>,
    );

    expect(
      screen.getByText('Do not disconnect the radio while this is running.'),
    ).toBeInTheDocument();
  });

  it('shows Close (and Retry when onRetry is provided and a step errored) once finished', () => {
    const onRetry = vi.fn();
    render(
      <DesignSystemV2Provider>
        <ProgressModal
          open
          phase="finished"
          steps={FINISHED_ERROR_STEPS}
          onClose={() => undefined}
          onRetry={onRetry}
        />
      </DesignSystemV2Provider>,
    );

    // Two "Close" buttons match: the ModalShell header dismiss icon and the footer action.
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('omits Retry when no step errored', () => {
    render(
      <DesignSystemV2Provider>
        <ProgressModal
          open
          phase="finished"
          steps={[{ id: 'connect', label: 'Connect', status: 'success' }]}
          onClose={() => undefined}
          onRetry={() => undefined}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows summary only once finished', () => {
    const { rerender } = render(
      <DesignSystemV2Provider>
        <ProgressModal
          open
          phase="running"
          steps={RUNNING_STEPS}
          onClose={() => undefined}
          summary={<span>3 of 3 channels written</span>}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByText('3 of 3 channels written')).not.toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <ProgressModal
          open
          phase="finished"
          steps={RUNNING_STEPS}
          onClose={() => undefined}
          summary={<span>3 of 3 channels written</span>}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('3 of 3 channels written')).toBeInTheDocument();
  });
});
