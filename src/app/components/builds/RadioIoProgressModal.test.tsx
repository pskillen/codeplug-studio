import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { DM32_POWER_CYCLE_AFTER_SESSION_NOTE } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
import RadioIoProgressModal, { writeDoneAlert } from './RadioIoProgressModal.tsx';

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

  it('shows write transfer stages from ProgressUpdate.stage', () => {
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'transfer',
      progress: {
        cur: 1,
        max: 2,
        msg: 'Writing Zones: block 1 of 2 (0x2000)',
        stage: 'Zones',
      },
      transferStages: ['Channels', 'Zones', 'Scan lists'],
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Writing to radio')).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Zones')).toBeInTheDocument();
  });

  it('shows OpenGD77 pre-write read stage during write upload', () => {
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'transfer',
      progress: {
        cur: 512,
        max: 1024,
        msg: 'Reading FLASH 0x3780',
        stage: 'Pre-write read',
      },
      transferStages: ['Pre-write read', 'FLASH sectors'],
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Pre-write read')).toBeInTheDocument();
    expect(screen.getByText('FLASH sectors')).toBeInTheDocument();
  });

  it('shows UV-17Pro family pre-write read and upload stages during write', () => {
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'transfer',
      progress: {
        cur: 120,
        max: 520,
        msg: 'Reading 0x9000',
        stage: 'Pre-write read',
      },
      transferStages: ['Pre-write read', 'Upload'],
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Pre-write read')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('shows RT95 pre-write read and upload stages during write', () => {
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'transfer',
      progress: {
        cur: 40,
        max: 810,
        msg: 'Reading 0x280',
        stage: 'Pre-write read',
      },
      transferStages: ['Pre-write read', 'Upload'],
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Pre-write read')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('keeps write checklist and shows Close when done', () => {
    const onClose = vi.fn();
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: {
        cur: 2,
        max: 2,
        msg: 'Writing Settings & other: block 2 of 2 (0x4000)',
        stage: 'Settings & other',
      },
      transferStages: ['Channels', 'Zones', 'Settings & other'],
      onCancel: vi.fn(),
      onClose,
    });

    expect(screen.getByText(/Write finished/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows navigation-blocked alert and invokes cancel', () => {
    const onCancel = vi.fn();
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'preparing',
      progress: null,
      navigationBlocked: true,
      onCancel,
    });

    expect(screen.getByText('Writing to radio')).toBeInTheDocument();
    expect(screen.getByText(/Stay on this page/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows assemble progress bar and message during preparing', () => {
    const { container } = renderModal({
      opened: true,
      operation: 'write',
      phase: 'preparing',
      progress: {
        cur: 250,
        max: 500,
        msg: 'Loading directory contacts',
      },
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Loading directory contacts')).toBeInTheDocument();
    expect(container.querySelector('.mantine-Progress-root')).toBeInTheDocument();
  });

  it('lists every planned stage before the first progress event, in a fixed-height list', () => {
    const plan = Array.from({ length: 30 }, (_, i) => ({ label: `Planned ${i}`, weight: 10 }));
    renderModal({
      opened: true,
      operation: 'write',
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
      operation: 'write',
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
      operation: 'write',
      phase: 'transfer',
      progress: { cur: 1, max: 2, msg: '', stage: 'Upload' },
      transferStages: ['Upload'],
      onCancel: vi.fn(),
    });
    expect(screen.queryByTestId('stage-list')).not.toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('shows unverified write done with optional verify actions', () => {
    const onVerify = vi.fn();
    const onCloseWithoutVerify = vi.fn();
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      transferStages: ['Upload'],
      writeVerifyStatus: 'unverified',
      requiresCrossSessionReconnect: true,
      verifyButtonEnabled: true,
      onCancel: vi.fn(),
      onVerify,
      onCloseWithoutVerify,
    });

    expect(screen.getByText('Write finished')).toBeInTheDocument();
    expect(screen.getByText(/Wait until the radio shows/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify write' }));
    expect(onVerify).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Skip verify' }));
    expect(onCloseWithoutVerify).toHaveBeenCalledTimes(1);
  });

  it('shows soft-reconnect unverified copy when radio does not restart', () => {
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'unverified',
      requiresCrossSessionReconnect: false,
      verifyButtonEnabled: true,
      onCancel: vi.fn(),
      onVerify: vi.fn(),
      onCloseWithoutVerify: vi.fn(),
    });

    expect(
      screen.getByText(/Click Verify write to compare memory with what was transmitted/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Wait until the radio shows/i)).not.toBeInTheDocument();
  });

  it('writeDoneAlert branches hard vs soft reconnect copy', () => {
    expect(writeDoneAlert('unverified', true).body).toMatch(/Wait until the radio shows/i);
    expect(writeDoneAlert('unverified', false).body).toMatch(/Click Verify write/i);
  });

  it('shows verified write done without verify actions', () => {
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'verified',
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText('Write finished — verify passed')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Verify write' })).not.toBeInTheDocument();
  });

  it('shows failed verify summary without inline mismatch list', () => {
    renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'failed',
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText('Write verify failed')).toBeInTheDocument();
    expect(screen.getByText(/See the verify report/i)).toBeInTheDocument();
  });

  it('disables verify briefly after write to prevent button mashing', () => {
    const onVerify = vi.fn();
    const { rerender } = renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'unverified',
      verifyButtonEnabled: false,
      onCancel: vi.fn(),
      onVerify,
      onCloseWithoutVerify: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Verify write' })).toBeDisabled();

    rerenderModal(rerender, {
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'unverified',
      verifyButtonEnabled: true,
      onCancel: vi.fn(),
      onVerify,
      onCloseWithoutVerify: vi.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verify write' }));
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it('shows a distinct title and step list for keps-write (#859)', () => {
    renderModal({
      opened: true,
      operation: 'keps-write',
      phase: 'transfer',
      progress: { cur: 1, max: 1, msg: 'Uploading satellite records' },
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Writing keps to radio')).toBeInTheDocument();
    expect(screen.getByText('Pack satellite records')).toBeInTheDocument();
    expect(screen.queryByText(/Assemble channels into image/i)).not.toBeInTheDocument();
  });

  it('shows a keps-write done alert with no verify actions', () => {
    const onClose = vi.fn();
    renderModal({
      opened: true,
      operation: 'keps-write',
      phase: 'done',
      progress: null,
      onCancel: vi.fn(),
      onClose,
    });

    expect(screen.getByText('Keps write finished')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify write' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows restore title and steps that are not writing a codeplug', () => {
    renderModal({
      opened: true,
      operation: 'restore',
      phase: 'transfer',
      progress: { cur: 1, max: 2, msg: 'Restoring channels' },
      onCancel: vi.fn(),
    });

    expect(screen.getByText('Restoring backup to radio')).toBeInTheDocument();
    expect(screen.getByText('Restore archive regions')).toBeInTheDocument();
    expect(screen.queryByText(/Writing codeplug/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Assemble channels into image/i)).not.toBeInTheDocument();
  });

  it('shows restore finished copy without write-verify actions', () => {
    const onClose = vi.fn();
    renderModal({
      opened: true,
      operation: 'restore',
      phase: 'done',
      progress: null,
      onCancel: vi.fn(),
      onClose,
    });

    expect(screen.getByText('Restore finished')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify write' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the caller success note on write and restore success', () => {
    const { rerender } = renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'none',
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).toBeInTheDocument();
    expect(screen.getByText(/page map from before this session/i)).toBeInTheDocument();

    rerenderModal(rerender, {
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'unverified',
      requiresCrossSessionReconnect: false,
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
      onVerify: vi.fn(),
      onCloseWithoutVerify: vi.fn(),
    });
    expect(screen.getByText(/Click Verify write/i)).toBeInTheDocument();
    expect(screen.getByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).toBeInTheDocument();

    rerenderModal(rerender, {
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'verified',
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Write finished — verify passed')).toBeInTheDocument();
    expect(screen.getByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).toBeInTheDocument();

    rerenderModal(rerender, {
      opened: true,
      operation: 'restore',
      phase: 'done',
      progress: null,
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Restore finished')).toBeInTheDocument();
    expect(screen.getByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).toBeInTheDocument();
  });

  it('hides the success note on verify failure, in-progress transfer, and when omitted', () => {
    const { rerender } = renderModal({
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      writeVerifyStatus: 'failed',
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Write verify failed')).toBeInTheDocument();
    expect(screen.queryByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).not.toBeInTheDocument();

    rerenderModal(rerender, {
      opened: true,
      operation: 'write',
      phase: 'transfer',
      progress: { cur: 1, max: 2, msg: 'Writing Zones' },
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
    });
    expect(screen.queryByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).not.toBeInTheDocument();

    rerenderModal(rerender, {
      opened: true,
      operation: 'write',
      phase: 'done',
      progress: null,
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Write finished/i)).toBeInTheDocument();
    expect(screen.queryByText(/page map from before this session/i)).not.toBeInTheDocument();

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

    rerenderModal(rerender, {
      opened: true,
      operation: 'keps-write',
      phase: 'done',
      progress: null,
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
      onCancel: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Keps write finished')).toBeInTheDocument();
    expect(screen.queryByText(DM32_POWER_CYCLE_AFTER_SESSION_NOTE)).not.toBeInTheDocument();
  });
});
