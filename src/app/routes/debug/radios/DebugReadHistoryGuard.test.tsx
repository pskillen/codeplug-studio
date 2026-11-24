import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { DebugReadHistoryGuard } from './DebugReadHistoryGuard.tsx';
import { debugRadioPath, radioDebugDescriptors } from './descriptors.ts';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';

const pathForSlug = (slug: string) =>
  debugRadioPath(radioDebugDescriptors.find((d) => d.slug === slug)!);

const store = getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' });
const d890 = getDebugReadHistory({ slug: 'at-d890uv', archiveModelId: 'AT-D890UV' });
const dm32 = getDebugReadHistory({ slug: 'dm-32uv', archiveModelId: 'DM-32UV' });
const mini = getDebugReadHistory({ slug: 'uv-5r-mini', archiveModelId: 'UV-5R Mini' });
afterEach(() =>
  act(() => {
    store.clear();
    mini.clear();
    d890.clear();
    dm32.clear();
  }),
);

it('blocks back navigation, allows Stay and Leave, and warns after leaving', async () => {
  const archive = exampleArchive();
  store.add({ ...archive, manifest: { ...archive.manifest, radioModelId: 'retevis-rt95' } });
  const rt95 = pathForSlug('rt95');
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
            path: rt95,
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
    { initialEntries: ['/other', rt95], initialIndex: 1 },
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
  ['/debug/radios/dm-32uv/stock/', dm32, 'DM-32UV'],
  ['/debug/radios/at-d890uv/stock/', d890, 'AT-D890UV'],
  ['/debug/radios/rt95/stock/', store, 'retevis-rt95'],
  ['/debug/radios/uv-5r-mini/stock/', mini, 'UV-5R Mini'],
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

it('protects DM-32 reads on Back, Stay, Leave and reload, but not other profiles', async () => {
  const archive = exampleArchive();
  dm32.add({ ...archive, manifest: { ...archive.manifest, radioModelId: 'DM-32UV' } });
  const dm32Path = pathForSlug('dm-32uv');
  const rt95Path = pathForSlug('rt95');
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
            path: dm32Path,
            element: <Link to={rt95Path}>Rt95</Link>,
          },
          { path: rt95Path, element: <Link to="/other">Other</Link> },
          { path: '/other', element: <span>Other page</span> },
        ],
      },
    ],
    { initialEntries: ['/other', dm32Path], initialIndex: 1 },
  );
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
  await act(() => router.navigate(-1));
  expect(await screen.findByText('Leave with undownloaded reads?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(router.state.location.pathname).toBe(dm32Path);
  fireEvent.click(screen.getByRole('link', { name: 'Rt95' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));
  // The RT95 page has no undownloaded reads of its own: its links are not blocked.
  fireEvent.click(await screen.findByRole('link', { name: 'Other' }));
  expect(await screen.findByText('Other page')).toBeInTheDocument();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(dm32.getSnapshot().undownloaded).toBe(1);
  act(() => dm32.markDownloaded(dm32.getSnapshot().entries.map((e) => e.id)));
  const quiet = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(quiet);
  expect(quiet.defaultPrevented).toBe(false);
});

const OG77 = [
  ['dm-1701-opengd77', 'DM-1701'],
  ['md-9600-opengd77', 'MD-9600'],
] as const;
const og77Stores = OG77.map(([slug, model]) =>
  getDebugReadHistory({ slug, archiveModelId: model }),
);
afterEach(() => act(() => og77Stores.forEach((s) => s.clear())));

it.each(OG77)(
  'protects OpenGD77 reads on %s (Stay, Leave, reload), and only when undownloaded',
  async (slug, model) => {
    const history = getDebugReadHistory({ slug, archiveModelId: model });
    const archive = exampleArchive();
    history.add({ ...archive, manifest: { ...archive.manifest, radioModelId: model } });
    const page = pathForSlug(slug);
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
            { path: page, element: <Link to="/other">Other</Link> },
            { path: '/other', element: <span>Other page</span> },
          ],
        },
      ],
      { initialEntries: [page] },
    );
    render(
      <MantineProvider>
        <RouterProvider router={router} />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Other' }));
    expect(await screen.findByText('Leave with undownloaded reads?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(router.state.location.pathname).toBe(page);
    fireEvent.click(screen.getByRole('link', { name: 'Other' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));
    expect(await screen.findByText('Other page')).toBeInTheDocument();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(history.getSnapshot().undownloaded).toBe(1);
    act(() => history.markDownloaded(history.getSnapshot().entries.map((e) => e.id)));
    const quiet = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);
  },
);

it('does not block switching firmware on the same radio when reads are only on one firmware', async () => {
  const history = getDebugReadHistory({ slug: 'md-9600-opengd77', archiveModelId: 'MD-9600' });
  const archive = exampleArchive();
  history.add({ ...archive, manifest: { ...archive.manifest, radioModelId: 'MD-9600' } });
  const opengd77 = pathForSlug('md-9600-opengd77');
  const radiofoundry = pathForSlug('md-9600-radiofoundry');
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
          { path: opengd77, element: <Link to={radiofoundry}>RadioFoundry</Link> },
          { path: radiofoundry, element: <span>RF page</span> },
        ],
      },
    ],
    { initialEntries: [opengd77] },
  );
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'RadioFoundry' }));
  expect(screen.queryByText('Leave with undownloaded reads?')).not.toBeInTheDocument();
  expect(await screen.findByText('RF page')).toBeInTheDocument();
});

it('blocks leaving the radio when any firmware still has undownloaded reads', async () => {
  const history = getDebugReadHistory({ slug: 'md-9600-opengd77', archiveModelId: 'MD-9600' });
  const archive = exampleArchive();
  history.add({ ...archive, manifest: { ...archive.manifest, radioModelId: 'MD-9600' } });
  const radiofoundry = pathForSlug('md-9600-radiofoundry');
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
          { path: radiofoundry, element: <Link to="/debug">Debug</Link> },
          { path: '/debug', element: <span>Debug index</span> },
        ],
      },
    ],
    { initialEntries: [radiofoundry] },
  );
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Debug' }));
  expect(await screen.findByText('Leave with undownloaded reads?')).toBeInTheDocument();
});

it('names no radio-specific literals in the guard source', () => {
  const source = readFileSync(path.join(import.meta.dirname, 'DebugReadHistoryGuard.tsx'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const literal of [
    'rt95',
    'at-d890uv',
    'dm-32uv',
    'uv-5r-mini',
    '/debug/uv5r-mini',
    'retevis-rt95',
    'AT-D890UV',
    'UV-5R Mini',
  ])
    expect(code).not.toContain(literal);
});
