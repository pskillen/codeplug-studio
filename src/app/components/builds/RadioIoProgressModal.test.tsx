import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { DM32_POWER_CYCLE_AFTER_SESSION_NOTE } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
import RadioIoProgressModal from './RadioIoProgressModal.tsx';

function renderModal(props: ComponentProps<typeof RadioIoProgressModal>) {
  return render(
    <MantineProvider>
      <DesignSystemV2Provider>
        <RadioIoProgressModal {...props} />
      </DesignSystemV2Provider>
    </MantineProvider>,
  );
}

function rerenderModal(
  rerender: ReturnType<typeof render>['rerender'],
  props: ComponentProps<typeof RadioIoProgressModal>,
) {
  rerender(
    <MantineProvider>
      <DesignSystemV2Provider>
        <RadioIoProgressModal {...props} />
      </DesignSystemV2Provider>
    </MantineProvider>,
  );
}

describe('RadioIoProgressModal', () => {
  it('shows the library save step and completion for Read into library', () => {
    const props = {
      opened: true,
      operation: 'library-read' as const,
      progress: null,
      onCancel: vi.fn(),
    };
    const { rerender } = renderModal({ ...props, phase: 'saving' });
    expect(screen.getByText('Reading into library')).toBeInTheDocument();
    expect(screen.getByText('Save library and build changes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    rerenderModal(rerender, { ...props, phase: 'done' });
    expect(screen.getByText('Library and build changes are saved.')).toBeInTheDocument();
    expect(screen.queryByText('Clone image is saved on this build.')).not.toBeInTheDocument();
  });

  it('shows keep-tab warning, read steps, and transfer progress', () => {
    renderModal({
      opened: true,
      operation: 'read',
      phase: 'transfer',
      progress: {
        cur: 10,
        max: 40,
        msg: 'Reading Channels: block 10 of 40',
        stage: 'Channels',
      },
      transferStages: ['Discover memory map', 'Channels', 'Zones'],
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Reading from radio')).toBeInTheDocument();
    expect(screen.getByText(/Keep this tab open/i)).toBeInTheDocument();
    expect(screen.getByText(/Discover memory map/i)).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Zones')).toBeInTheDocument();
  });

  it('shows navigation-blocked alert and invokes cancel', () => {
    const onCancel = vi.fn();
    renderModal({
      opened: true,
      operation: 'read',
      phase: 'transfer',
      progress: null,
      navigationBlocked: true,
      onCancel,
    });

    expect(screen.getByText('Reading from radio')).toBeInTheDocument();
    expect(screen.getByText(/Stay on this page/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('lists every planned stage before the first progress event, in a fixed-height list', () => {
    const plan = Array.from({ length: 30 }, (_, i) => ({ label: `Planned ${i}`, weight: 10 }));
    renderModal({
      opened: true,
      operation: 'read',
      phase: 'transfer',
      progress: null,
      plan,
      onCancel: vi.fn(),
    });
    expect(screen.getByText('Planned 0')).toBeInTheDocument();
    expect(screen.getByText('Planned 29')).toBeInTheDocument();
    const list = screen.getByTestId('stage-list');
    expect(list.style.maxHeight).not.toBe('');
    expect(list.style.overflowY).toBe('auto');
    // Nothing is marked done before the first event; the first planned stage is current.
    expect(screen.getByText('Planned 0').closest('li')).toHaveAttribute('data-status', 'active');
    expect(screen.getByText('Planned 29').closest('li')).toHaveAttribute('data-status', 'pending');
  });

  it('appends a stage the plan did not name instead of dropping it', () => {
    renderModal({
      opened: true,
      operation: 'read',
      phase: 'transfer',
      progress: { cur: 1, max: 2, msg: '', stage: 'Surprise' },
      transferStages: ['Planned A', 'Surprise'],
      plan: [{ label: 'Planned A', weight: 10 }],
      onCancel: vi.fn(),
    });
    expect(screen.getByText('Surprise').closest('li')).toHaveAttribute('data-status', 'active');
    expect(screen.getByText('Planned A').closest('li')).toHaveAttribute('data-status', 'success');
  });

  it('falls back to the growing list when there is no plan', () => {
    renderModal({
      opened: true,
      operation: 'read',
      phase: 'transfer',
      progress: { cur: 1, max: 2, msg: '', stage: 'Upload' },
      transferStages: ['Upload'],
      onCancel: vi.fn(),
    });
    expect(screen.queryByTestId('stage-list')).not.toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('offers the caller finish action beside Close once a read finishes', () => {
    const onBack = vi.fn();
    renderModal({
      opened: true,
      operation: 'read',
      phase: 'done',
      progress: null,
      finishAction: { label: 'Back to Export', onClick: onBack },
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Export' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not show an omitted success note after read', () => {
    const { rerender } = renderModal({
      opened: true,
      operation: 'read',
      phase: 'transfer',
      progress: { cur: 1, max: 2, msg: 'Restoring Zones' },
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
    });
    expect(screen.queryByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).not.toBeInTheDocument();

    rerenderModal(rerender, {
      opened: true,
      operation: 'read',
      phase: 'done',
      progress: null,
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.queryByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByTestId('radio-io-progress-success-note')).not.toBeInTheDocument();
  });
});
