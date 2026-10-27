import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AT_D890_PENDING_UNITS_KEY } from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import DebugLocalStoragePage from './DebugLocalStoragePage.tsx';

describe('DebugLocalStoragePage delete (#1406)', () => {
  it('deletes a key after a second, confirming click', () => {
    localStorage.setItem(AT_D890_PENDING_UNITS_KEY, '{"v":2,"radios":{}}');
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <DebugLocalStoragePage />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    // Only this key is set, so it has the only Delete button.
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // Not gone yet: one click only asks.
    expect(localStorage.getItem(AT_D890_PENDING_UNITS_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(localStorage.getItem(AT_D890_PENDING_UNITS_KEY)).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});
