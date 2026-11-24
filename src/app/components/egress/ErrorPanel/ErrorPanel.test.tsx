import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorPanel from './ErrorPanel.tsx';
import type { WriteErrorOutcome } from '../../../services/egress/writeErrorOutcome.ts';

const errorOutcome: WriteErrorOutcome = {
  kind: 'error',
  retry: 'rewrite',
  sent: 'may-hold-part',
  message: 'Serial pipe closed unexpectedly.',
  debugText: 'op: upload\nstack:\nnone',
  code: 'closed',
};

describe('ErrorPanel', () => {
  it('shows the part-way title and chip for may-hold-part', () => {
    render(
      <ErrorPanel outcome={errorOutcome} retryLabel="Write again" onRetry={() => undefined} />,
    );
    expect(screen.getByText('The write stopped part way')).toBeInTheDocument();
    expect(screen.getByText('May hold part of the write')).toBeInTheDocument();
  });

  it('shows no retry button when retryLabel is null', () => {
    render(
      <ErrorPanel
        outcome={{ ...errorOutcome, retry: 'none' }}
        retryLabel={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Write again' })).toBeNull();
  });

  it('calls onRetry from the labelled button', () => {
    const onRetry = vi.fn();
    render(<ErrorPanel outcome={errorOutcome} retryLabel="Write again" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('always offers Debug details and copies message and debug text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ErrorPanel outcome={errorOutcome} retryLabel={null} />);
    expect(screen.getByText('Debug details')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy debug text' }));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(
      'Serial pipe closed unexpectedly.\n\nop: upload\nstack:\nnone',
    );
    vi.unstubAllGlobals();
  });

  it('renders nothing for a cancelled outcome', () => {
    const { container } = render(
      <ErrorPanel
        outcome={{
          ...errorOutcome,
          kind: 'cancelled',
          retry: 'none',
          sent: 'nothing-sent',
        }}
        retryLabel={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
