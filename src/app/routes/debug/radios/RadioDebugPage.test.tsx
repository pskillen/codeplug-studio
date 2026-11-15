import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';

const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@app/services/uv5rMiniDebugRead.ts', () => ({
  grantUv5rMiniDebugPort: vi.fn(async () => ({})),
  runUv5rMiniDebugFullRead: fake.run,
}));
function open() {
  render(
    <MemoryRouter initialEntries={['/debug/radios/uv-5r-mini']}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
}
describe('Mini shared page read', () => {
  it('cancels an in-flight read and reports its failure', async () => {
    fake.run.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('Cancelled'))),
        ),
    );
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument(),
    );
  });
  it('shows a failed read without replacing the page', async () => {
    fake.run.mockRejectedValueOnce(new Error('Synthetic read error'));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    expect(await screen.findByText('Synthetic read error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read radio' })).toBeInTheDocument();
  });
});
