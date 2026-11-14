import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import ReferenceIndexPage from './ReferenceIndexPage.tsx';

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/reference', element: <ReferenceIndexPage /> },
      { path: '/firmware', element: <p>Flasher page</p> },
    ],
    { initialEntries: ['/reference'] },
  );
  render(<RouterProvider router={router} />);
}

describe('ReferenceIndexPage', () => {
  it('shows one card per Tools strip destination, firmware flasher first, propagation hidden', () => {
    renderPage();
    const titles = screen
      .getAllByRole('button')
      .map((card) => card.querySelector('span:nth-child(2) > span')?.textContent);
    // Tests run as the `local` build, where the flasher is offered.
    expect(titles).toEqual([
      'Firmware flasherNEW',
      'My locator',
      'Distance & bearing',
      'Nearby repeaters',
      'Band plan',
      'Tracking Dashboard',
    ]);
    expect(screen.queryByText('Propagation Visualiser')).toBeNull();
    expect(screen.queryByText(/sidebar/i)).toBeNull();
  });

  it('links the Debug index and each Debug page where the gate allows them (#1673)', () => {
    // Tests run as the `local` build, where the Debug pages are shown.
    renderPage();
    expect(screen.getByRole('heading', { name: 'Debug' })).toBeTruthy();
    const links = screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Debug overview', '/debug'],
      ['IndexedDB', '/debug/indexed-db'],
      ['localStorage', '/debug/local-storage'],
      ['AT-D890UV erase-unit probeDesktop Chrome / Edge', '/debug/d890-erase-probe'],
      ['Serial reopen timingDesktop Chrome / Edge', '/debug/serial-reopen'],
      ['UV-5R Mini full readDesktop Chrome / Edge', '/debug/uv5r-mini'],
    ]);
  });

  it('opens the tool when its card is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Firmware flasher/ }));
    expect(screen.getByText('Flasher page')).toBeTruthy();
  });
});
