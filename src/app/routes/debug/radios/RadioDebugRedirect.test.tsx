import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugRedirect from './RadioDebugRedirect.tsx';
import RadioDebugPage from './RadioDebugPage.tsx';

function routerAt(path: string) {
  return createMemoryRouter(
    [
      { path: '/debug/radios/:radio', element: <RadioDebugRedirect /> },
      { path: '/debug/radios/:radio/:firmware', element: <RadioDebugPage /> },
    ],
    { initialEntries: [path] },
  );
}

describe('RadioDebugRedirect', () => {
  it('preserves query and hash when redirecting a legacy slug', async () => {
    const router = routerAt('/debug/radios/md-9600-opengd77?x=1#h');
    render(
      <DesignSystemV2Provider>
        <RouterProvider router={router} />
      </DesignSystemV2Provider>,
    );
    expect(router.state.location.pathname).toBe('/debug/radios/md-9600/opengd77');
    expect(router.state.location.search).toBe('?x=1');
    expect(router.state.location.hash).toBe('#h');
  });

  it('redirects a bare radio key to its first firmware', () => {
    const router = routerAt('/debug/radios/rt95');
    render(
      <DesignSystemV2Provider>
        <RouterProvider router={router} />
      </DesignSystemV2Provider>,
    );
    expect(router.state.location.pathname).toBe('/debug/radios/rt95/stock');
  });

  it('opens OpenGD77 first for MD-9600', () => {
    const router = routerAt('/debug/radios/md-9600');
    render(
      <DesignSystemV2Provider>
        <RouterProvider router={router} />
      </DesignSystemV2Provider>,
    );
    expect(router.state.location.pathname).toBe('/debug/radios/md-9600/opengd77');
  });

  it('shows Radio not found for an unknown key', () => {
    const router = routerAt('/debug/radios/nope');
    render(
      <DesignSystemV2Provider>
        <RouterProvider router={router} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Radio not found' })).toBeInTheDocument();
  });
});
