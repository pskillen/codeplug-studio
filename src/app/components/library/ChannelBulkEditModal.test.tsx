import { emptyLibrary, newChannel } from '@core/domain/factories.ts';
import type { ChannelBulkEditPatch } from '@core/domain/channelBulkEdit.ts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistChannelBulkEdit } from '../../lib/channelBulkEdit.ts';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelBulkEditModal from './ChannelBulkEditModal.tsx';

vi.mock('../../lib/channelBulkEdit.ts', () => ({ persistChannelBulkEdit: vi.fn() }));
vi.mock('../../state/persistence.ts', () => ({ persistence: {} }));

function renderModal() {
  const channels = [
    { ...newChannel('p', 'First'), power: 101 },
    { ...newChannel('p', 'Second'), power: 100 },
  ];
  render(
    <DesignSystemV2Provider>
      <MemoryRouter>
        <ChannelBulkEditModal
          opened
          onClose={vi.fn()}
          channels={channels}
          projectId="p"
          library={{ ...emptyLibrary(), channels }}
          deleteEntity={vi.fn()}
          reload={vi.fn()}
        />
      </MemoryRouter>
    </DesignSystemV2Provider>,
  );
  return within(screen.getByRole('dialog'));
}

const persist = vi.mocked(persistChannelBulkEdit);

async function expectAppliedPatch(patch: ChannelBulkEditPatch) {
  fireEvent.click(screen.getByRole('button', { name: 'Apply to 2 channels' }));
  await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  expect(persist.mock.calls[0][0].patch).toEqual(patch);
}

describe('ChannelBulkEditModal power', () => {
  beforeEach(() => {
    persist.mockReset().mockResolvedValue({ ok: true, updatedCount: 2, skippedCount: 0 });
  });

  it('applies 101 when Custom is set to Above High', async () => {
    const dialog = renderModal();
    fireEvent.click(dialog.getByRole('radio', { name: 'Custom' }));
    const slider = dialog.getByRole('slider', { name: 'Level' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Above High');
    await expectAppliedPatch({ power: 101 });
  });

  it('applies null when Power is set to Default', async () => {
    const dialog = renderModal();
    const powerDefault = dialog
      .getByRole('radio', { name: 'Custom' })
      .closest<HTMLElement>('[role="radiogroup"]')!;
    fireEvent.click(within(powerDefault).getByRole('radio', { name: 'Default' }));
    await expectAppliedPatch({ power: null });
  });

  it('excludes power from unrelated patches even with an Above High preview dot', async () => {
    const dialog = renderModal();
    const slider = dialog.getByRole('slider', { name: 'Level' });
    expect(slider).toHaveAttribute('aria-disabled', 'true');
    expect(document.querySelector('[data-preview-dots] span')).toHaveStyle({ left: '100%' });
    fireEvent.click(dialog.getByRole('radio', { name: 'RX only' }));
    await expectAppliedPatch({ forbidTransmit: 'forbid' });
  });
});
