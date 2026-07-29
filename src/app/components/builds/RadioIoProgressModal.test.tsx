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
          progress={{
            cur: 10,
            max: 40,
            msg: 'Reading Channels: block 10 of 40',
            stage: 'Channels',
          }}
          transferStages={['Discover memory map', 'Channels', 'Zones']}
          onCancel={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Reading from radio')).toBeInTheDocument();
    expect(screen.getByText(/Keep this tab open/i)).toBeInTheDocument();
    expect(screen.getByText(/Discover memory map/i)).toBeInTheDocument();
    expect(screen.getByText(/→ Channels/)).toBeInTheDocument();
    expect(screen.getByText(/· Zones/)).toBeInTheDocument();
    expect(screen.getByText(/Reading Channels: block 10 of 40 \(10\/40\)/)).toBeInTheDocument();
  });

  it('shows write transfer stages from ProgressUpdate.stage', () => {
    render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="transfer"
          progress={{
            cur: 1,
            max: 2,
            msg: 'Writing Zones: block 1 of 2 (0x2000)',
            stage: 'Zones',
          }}
          transferStages={['Channels', 'Zones', 'Scan lists']}
          onCancel={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Writing to radio')).toBeInTheDocument();
    expect(screen.getByText(/✓ Channels/)).toBeInTheDocument();
    expect(screen.getByText(/→ Zones/)).toBeInTheDocument();
    expect(screen.getByText(/Writing Zones: block 1 of 2 \(0x2000\) \(1\/2\)/)).toBeInTheDocument();
  });

  it('keeps write checklist and shows Close when done', () => {
    const onClose = vi.fn();
    render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="done"
          progress={{
            cur: 2,
            max: 2,
            msg: 'Writing Settings & other: block 2 of 2 (0x4000)',
            stage: 'Settings & other',
          }}
          transferStages={['Channels', 'Zones', 'Settings & other']}
          onCancel={vi.fn()}
          onClose={onClose}
        />
      </MantineProvider>,
    );

    expect(screen.getByText(/Write finished/i)).toBeInTheDocument();
    expect(screen.getByText(/✓ Upload to radio/)).toBeInTheDocument();
    expect(screen.getByText(/→ Write complete/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('shows unverified write done with optional verify actions', () => {
    const onVerify = vi.fn();
    const onCloseWithoutVerify = vi.fn();
    render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="done"
          progress={null}
          transferStages={['Upload']}
          writeVerifyStatus="unverified"
          verifyButtonEnabled
          onCancel={vi.fn()}
          onVerify={onVerify}
          onCloseWithoutVerify={onCloseWithoutVerify}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Write finished')).toBeInTheDocument();
    expect(screen.getByText(/Wait until it shows its normal screen/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify write' }));
    expect(onVerify).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Skip verify' }));
    expect(onCloseWithoutVerify).toHaveBeenCalledTimes(1);
  });

  it('shows verified write done without verify actions', () => {
    render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="done"
          progress={null}
          writeVerifyStatus="verified"
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Write finished — verify passed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify write' })).not.toBeInTheDocument();
  });

  it('shows failed verify summary without inline mismatch list', () => {
    render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="done"
          progress={null}
          writeVerifyStatus="failed"
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Write verify failed')).toBeInTheDocument();
    expect(screen.getByText(/See the verify report/i)).toBeInTheDocument();
  });

  it('disables verify briefly after write to prevent button mashing', () => {
    const onVerify = vi.fn();
    const { rerender } = render(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="done"
          progress={null}
          writeVerifyStatus="unverified"
          verifyButtonEnabled={false}
          onCancel={vi.fn()}
          onVerify={onVerify}
          onCloseWithoutVerify={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'Verify write' })).toBeDisabled();

    rerender(
      <MantineProvider>
        <RadioIoProgressModal
          opened
          operation="write"
          phase="done"
          progress={null}
          writeVerifyStatus="unverified"
          verifyButtonEnabled
          onCancel={vi.fn()}
          onVerify={onVerify}
          onCloseWithoutVerify={vi.fn()}
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Verify write' }));
    expect(onVerify).toHaveBeenCalledTimes(1);
  });
});
