import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HfPropagationPage from './HfPropagationPage.tsx';

vi.mock('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx', () => ({
  default: () => <div data-testid="globe-stub" />,
}));

async function renderPage() {
  const view = render(
    <MantineProvider>
      <HfPropagationPage />
    </MantineProvider>,
  );
  await waitFor(() => {
    expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
  });
  return view;
}

describe('HfPropagationPage slice-plane picker', () => {
  it('hides the slice-plane picker until Vertical slice is selected', async () => {
    await renderPage();

    expect(screen.queryByTestId('slice-plane-readout')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vertical slice' }));

    expect(screen.getByTestId('slice-plane-readout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bearing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Locator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Address' })).toBeInTheDocument();
  });
});
