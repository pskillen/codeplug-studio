import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';

// The capability badges left the Debug index (one card per radio); the radio page's Overview keeps them.
// These are the statuses the index test used to check, now read where the badges live.
function open(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio/:firmware" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

function capabilityLine(name: string): HTMLElement {
  const line = screen
    .getAllByText(new RegExp(`^${name} ·`))
    .map((el) => el.closest('div'))
    .find((el): el is HTMLDivElement => el !== null);
  if (!line) throw new Error(`no ${name} capability line`);
  return line;
}

afterEach(cleanup);

describe('Overview capability badges', () => {
  it.each([
    [
      '/debug/radios/uv-5r-mini/stock',
      { Backup: 'Available', Calibration: 'Partial', Memory: 'Partial' },
    ],
    [
      '/debug/radios/rt95/stock',
      { Backup: 'Available', Calibration: 'Partial', Memory: 'Partial' },
    ],
    ['/debug/radios/at-d890uv/stock', { Backup: 'Available', Memory: 'Partial' }],
    [
      '/debug/radios/dm-32uv/stock',
      { Backup: 'Available', Calibration: 'Partial', Memory: 'Partial' },
    ],
  ] as const)('%s shows its real capability status', (path, expected) => {
    open(path);
    for (const [name, status] of Object.entries(expected)) {
      expect(capabilityLine(name)).toHaveTextContent(`${name} · ${status}`);
    }
  });
});
