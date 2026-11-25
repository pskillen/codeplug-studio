import { MantineProvider } from '@mantine/core';
import { emptyLibrary } from '@core/domain/factories.ts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ChannelSetPicker from './ChannelSetPicker.tsx';

const { putChannel } = vi.hoisted(() => ({ putChannel: vi.fn() }));

vi.mock('../../state/persistence.ts', () => ({ persistence: { putChannel } }));
vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'p' }),
}));
vi.mock('../../state/useLibrary.ts', () => ({
  useLibrary: () => ({ library: emptyLibrary() }),
}));

describe('ChannelSetPicker power override', () => {
  it.each([
    ['101', 101],
    ['42.5', 42.5],
    ['', null],
  ])('accepts %j after blocking invalid numeric overrides', async (input, power) => {
    putChannel.mockReset().mockResolvedValue({ ok: true });
    render(
      <MantineProvider>
        <MemoryRouter>
          <ChannelSetPicker />
        </MemoryRouter>
      </MantineProvider>,
    );
    const field = screen.getByRole('spinbutton', { name: 'Power (%)' });
    const add = screen.getByRole('button', { name: /^Add \d+ channels$/ });
    expect(screen.getByText(/101 for Above High/)).toBeVisible();

    for (const invalid of ['100.5', '102']) {
      fireEvent.input(field, { target: { value: invalid } });
      expect(field).toBeInvalid();
      expect(add).toBeDisabled();
      fireEvent.click(add);
      expect(putChannel).not.toHaveBeenCalled();
    }

    fireEvent.input(field, { target: { value: input } });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    await waitFor(() =>
      expect(putChannel).toHaveBeenCalledWith(expect.objectContaining({ power }), null),
    );
  });
});
