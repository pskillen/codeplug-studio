import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DesignSystemV2Provider } from '../v2/index.ts';
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
});
