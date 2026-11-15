import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { DebugReadHistoryGuard } from './DebugReadHistoryGuard.tsx';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';

const store = getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' });
const d890 = getDebugReadHistory({ slug: 'at-d890uv', archiveModelId: 'AT-D890UV' });
const mini = getDebugReadHistory({ slug: 'uv-5r-mini', archiveModelId: 'UV-5R Mini' });
afterEach(() =>
  act(() => {
    store.clear();
    mini.clear();
    d890.clear();
  }),
);

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

it.each([
  ['/debug/radios/at-d890uv/', d890, 'AT-D890UV'],
  ['/debug/radios/rt95/', store, 'retevis-rt95'],
  ['/debug/radios/uv-5r-mini/', mini, 'UV-5R Mini'],
  ['/debug/uv5r-mini/', mini, 'UV-5R Mini'],
] as const)('protects the trailing-slash route %s', async (path, history, model) => {
  const archive = exampleArchive();
  history.add({ ...archive, manifest: { ...archive.manifest, radioModelId: model } });
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
          { path, element: <Link to="/other">Other</Link> },
          { path: '/other', element: <span>Other page</span> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Other' }));
  expect(await screen.findByText('Leave with undownloaded reads?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
  expect(await screen.findByText('Other page')).toBeInTheDocument();
});
