import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';

const hoisted = vi.hoisted(() => ({
  run: vi.fn(),
  keepAwake: vi.fn(async () => {}),
  allowSleep: vi.fn(async () => {}),
}));
vi.mock('@integrations/platform/isNativeApp.ts', () => ({ isNativeApp: () => true }));
vi.mock('@integrations/platform/keepAwake.ts', () => ({
  KeepAwake: { keepAwake: hoisted.keepAwake, allowSleep: hoisted.allowSleep },
}));
vi.mock('@app/services/uv5rMiniDebugRead.ts', () => ({
  grantUv5rMiniDebugPort: vi.fn(async () => ({})),
  runUv5rMiniDebugFullRead: hoisted.run,
}));

import RadioDebugPage from './RadioDebugPage.tsx';

describe('debug page live read keeps the screen awake', () => {
  it('holds the lock during the read and releases it when the read fails', async () => {
    let fail: (e: Error) => void = () => {};
    hoisted.run.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
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
    await waitFor(() => expect(hoisted.keepAwake).toHaveBeenCalledTimes(1));
    expect(hoisted.allowSleep).not.toHaveBeenCalled();

    fail(new Error('Synthetic read error'));
    expect(await screen.findByText('Synthetic read error')).toBeInTheDocument();
    expect(hoisted.allowSleep).toHaveBeenCalledTimes(1);
  });
});
