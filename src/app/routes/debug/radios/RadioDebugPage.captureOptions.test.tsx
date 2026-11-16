import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { OPENGD77_DM1701_MODEL_ID } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';
import RadioDebugPage from './RadioDebugPage.tsx';

const fake = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('./opengd77Capture.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./opengd77Capture.ts')>()),
  captureOpenGd77: () => fake.capture,
}));

beforeEach(() => {
  fake.capture.mockReset();
  fake.capture.mockImplementation(async () => syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID));
});

function open(slug: string) {
  render(
    <MemoryRouter initialEntries={[`/debug/radios/${slug}`]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
}

it('reads OpenGD77 without the User Database unless the tick box is ticked', async () => {
  open('dm-1701-opengd77');
  const box = screen.getByRole('checkbox', { name: 'Also read the User Database' });
  expect(box).not.toBeChecked();
  expect(screen.getByText(/up to about 14 MB/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  await waitFor(() => expect(fake.capture).toHaveBeenCalledTimes(1));
  expect(fake.capture.mock.calls[0]![0].options).toEqual({ userDatabase: false });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Read radio' })).toBeEnabled());

  fireEvent.click(box);
  expect(box).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  await waitFor(() => expect(fake.capture).toHaveBeenCalledTimes(2));
  expect(fake.capture.mock.calls[1]![0].options).toEqual({ userDatabase: true });
});

it('shows no capture tick boxes for radios without options', () => {
  open('rt95');
  expect(screen.queryByRole('checkbox', { name: /User Database/ })).not.toBeInTheDocument();
});
