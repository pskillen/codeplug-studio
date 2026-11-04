import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelDuplicateButton from './ChannelDuplicateButton.tsx';

const { putChannel } = vi.hoisted(() => ({
  putChannel: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock('../../state/persistence.ts', () => ({ persistence: { putChannel } }));

const source = newChannel('p1', 'Newry', 'GB3NY');

function renderButton(includesUnsavedEdits = false) {
  render(
    <MemoryRouter initialEntries={['/here']}>
      <DesignSystemV2Provider>
        <Routes>
          <Route
            path="/here"
            element={
              <ChannelDuplicateButton
                projectId="p1"
                getSource={() => source}
                includesUnsavedEdits={includesUnsavedEdits}
              />
            }
          />
          <Route path="/library/channels/:id/edit" element={<p>Editor</p>} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

describe('ChannelDuplicateButton', () => {
  it('asks first and writes nothing on cancel', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByText('Duplicate channel?')).toBeInTheDocument();
    expect(screen.getByText('Newry (copy)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(putChannel).not.toHaveBeenCalled();
  });

  it('creates the copy and opens it in the editor on confirm', async () => {
    renderButton(true);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(
      await screen.findByText(/unsaved edits on this page go into the copy/),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Duplicate' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(screen.getByText('Editor')).toBeInTheDocument());
    expect(putChannel).toHaveBeenCalledTimes(1);
  });
});
