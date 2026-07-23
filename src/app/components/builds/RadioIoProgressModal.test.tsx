import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import RadioIoProgressModal from './RadioIoProgressModal.tsx';

describe('RadioIoProgressModal', () => {
  it('shows keep-tab warning, read steps, and transfer progress', () => {
    render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="read"
          phase="transfer"
          progress={{ cur: 10, max: 40, msg: 'Reading 0x280' }}
          onCancel={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Reading from radio')).toBeInTheDocument();
    expect(screen.getByText(/Keep this tab open/i)).toBeInTheDocument();
    expect(screen.getByText(/Download clone image/i)).toBeInTheDocument();
    expect(screen.getByText(/Reading 0x280 \(10\/40\)/)).toBeInTheDocument();
  });

  it('shows navigation-blocked alert and invokes cancel', () => {
    const onCancel = vi.fn();
    render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="preparing"
          progress={null}
          navigationBlocked
          onCancel={onCancel}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Writing to radio')).toBeInTheDocument();
    expect(screen.getByText(/Stay on this page/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
