import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';

const hoisted = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@app/services/uv5rMiniDebugRead.ts', () => ({
  grantUv5rMiniDebugPort: vi.fn(async () => ({})),
  runUv5rMiniDebugFullRead: hoisted.run,
}));

import RadioDebugPage from './RadioDebugPage.tsx';

describe('debug page read progress', () => {
  it('shows the stage, a cur/max bar and the message from the capture', async () => {
    let report: ProgressFn = () => {};
    hoisted.run.mockImplementation(
      (input: { onProgress?: ProgressFn }) =>
        new Promise(() => {
          report = input.onProgress!;
        }),
    );
    render(
      <MemoryRouter initialEntries={['/debug/radios/uv-5r-mini/stock']}>
        <DesignSystemV2Provider>
          <Routes>
            <Route path="/debug/radios/:radio/:firmware" element={<RadioDebugPage />} />
          </Routes>
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    expect(await screen.findByText('Connecting…')).toBeInTheDocument();
    await vi.waitFor(() => expect(hoisted.run).toHaveBeenCalled());
    act(() => report({ cur: 0, max: 0, msg: 'Handshaking', stage: 'Connect' }));
    expect(screen.getByTestId('debug-read-stage')).toHaveTextContent('Connect');
    expect(screen.queryByTestId('debug-read-bar')).toBeNull();
    act(() => report({ cur: 5, max: 20, msg: 'Reading 0x0140', stage: 'Clone read' }));
    expect(screen.getByTestId('debug-read-stage')).toHaveTextContent('Clone read');
    expect(screen.getByTestId('debug-read-bar')).toBeInTheDocument();
    expect(screen.getByText('Reading 0x0140 (5 / 20)')).toBeInTheDocument();
  });
});
