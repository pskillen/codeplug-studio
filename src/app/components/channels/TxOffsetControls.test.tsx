import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import TxOffsetControls from './TxOffsetControls.tsx';

describe('TxOffsetControls', () => {
  it('renders nothing without a valid RX frequency', () => {
    render(
      <MantineProvider>
        <TxOffsetControls rxFrequencyHz={null} txFrequencyHz={null} onTxFrequencyChange={vi.fn()} />
      </MantineProvider>,
    );
    expect(screen.queryByText(/Offset/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows 2 m offsets and applies −0.6 on click', () => {
    const onTx = vi.fn();
    render(
      <MantineProvider>
        <TxOffsetControls
          rxFrequencyHz={145_500_000}
          txFrequencyHz={145_500_000}
          onTxFrequencyChange={onTx}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('===')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simplex' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '−0.6 MHz' }));
    expect(onTx).toHaveBeenCalledWith('144.9');
  });

  it('highlights the matching 70 cm offset', () => {
    render(
      <MantineProvider>
        <TxOffsetControls
          rxFrequencyHz={433_000_000}
          txFrequencyHz={440_600_000}
          onTxFrequencyChange={vi.fn()}
        />
      </MantineProvider>,
    );

    const active = screen.getByRole('button', { name: '+7.6 MHz' });
    expect(active).toHaveAttribute('data-variant', 'filled');
    expect(screen.getByRole('button', { name: 'Simplex' })).toHaveAttribute(
      'data-variant',
      'light',
    );
  });
});
