import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import MaidenheadRedirectPage from './MaidenheadRedirectPage.tsx';
import { wantsBearing } from './wantsBearing.ts';

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/reference/maidenhead', element: <MaidenheadRedirectPage /> },
      { path: '/tools/locator', element: <p>Locator tool</p> },
      { path: '/tools/bearing', element: <p>Bearing tool</p> },
    ],
    { initialEntries: [url] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('MaidenheadRedirectPage', () => {
  it('sends the bare page to My locator', () => {
    const router = renderAt('/reference/maidenhead');
    expect(screen.getByText('Locator tool')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/tools/locator');
  });

  it('sends the Bearing view to Distance & bearing', () => {
    renderAt('/reference/maidenhead?mode=bearing');
    expect(screen.getByText('Bearing tool')).toBeTruthy();
  });

  it('understands the tab param too', () => {
    expect(wantsBearing(new URLSearchParams('tab=Bearing'))).toBe(true);
    expect(wantsBearing(new URLSearchParams('mode=convert'))).toBe(false);
  });
});
