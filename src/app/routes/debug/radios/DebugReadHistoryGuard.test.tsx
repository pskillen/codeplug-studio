import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { DebugReadHistoryGuard } from './DebugReadHistoryGuard.tsx';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';

const store = getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' });
afterEach(() => act(() => store.clear()));

it('blocks back navigation, allows Stay and Leave, and warns after leaving', async () => {
  const archive = exampleArchive();
  store.add({ ...archive, manifest: { ...archive.manifest, radioModelId: 'retevis-rt95' } });
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <DebugReadHistoryGuard />
            <Outlet />
          </>
        ),
        children: [
          {
            path: '/debug/radios/rt95',
            element: (
              <>
                <span>Radio</span>
                <Link to="/other">Other</Link>
              </>
            ),
          },
          { path: '/other', element: <span>Other page</span> },
        ],
      },
    ],
    { initialEntries: ['/other', '/debug/radios/rt95'], initialIndex: 1 },
  );
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
  await act(() => router.navigate(-1));
  expect(await screen.findByText('Leave with undownloaded reads?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(screen.getByText('Radio')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Other' }));
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
  expect(await screen.findByText('Other page')).toBeInTheDocument();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(store.getSnapshot().undownloaded).toBe(1);
});
