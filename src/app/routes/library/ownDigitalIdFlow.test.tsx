/**
 * The D12 flow through the real UI, `useLibrary` and `LibraryService` over the in-memory store:
 * the first ID becomes the default, Set as default moves it, deleting the default leaves none,
 * and an ID that a channel uses cannot be deleted. Only the store and the active project are
 * supplied by the test.
 */
import {
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newChannel, newOwnDigitalId, newProjectMeta } from '@core/domain/factories.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import type { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';

// One store for the file (the editor builds its service at import); each test gets its own project.
// The whole suite runs in parallel; a list reload can take longer than the 1 s default.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20_000 });

const hoisted = vi.hoisted(() => ({
  store: null as unknown as InMemoryProjectPersistence,
  projectId: 'p',
}));

vi.mock('../../state/persistence.ts', async () => {
  const { InMemoryProjectPersistence: Store } = await import('@integrations/persistence/index.ts');
  hoisted.store = new Store();
  return { persistence: hoisted.store };
});
vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: hoisted.projectId }),
}));

import { OwnDigitalIdEditor } from './OwnDigitalIdEditor.tsx';
import DigitalIdsListPage from './lists/DigitalIdsListPage.tsx';
import { useLibrary } from '../../state/useLibrary.ts';

function EditRoute() {
  const { id } = useParams();
  const { library, loading } = useLibrary();
  if (loading) return null;
  const entity = library.ownDigitalIds.find((row) => row.id === id) ?? null;
  return <OwnDigitalIdEditor projectId={hoisted.projectId} entity={entity} />;
}

function renderApp(initial: string) {
  const router = createMemoryRouter(
    [
      { path: '/library/digital-ids', element: <DigitalIdsListPage /> },
      {
        path: '/library/digital-ids/new',
        element: <OwnDigitalIdEditor projectId={hoisted.projectId} entity={null} />,
      },
      { path: '/library/digital-ids/:id', element: <EditRoute /> },
    ],
    { initialEntries: [initial] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

/** Fill the open editor (retrying until it is up), optionally wait for something, press Save. */
async function fillAndSave(name: string, number: string, beforeSave?: () => Promise<void>) {
  await waitFor(() => {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
    fireEvent.change(screen.getByLabelText('DMR ID'), { target: { value: number } });
  });
  await beforeSave?.();
  fireEvent.click(screen.getByRole('button', { name: 'Save Digital ID' }));
}

async function addId(router: ReturnType<typeof renderApp>, name: string, number: string) {
  await router.navigate('/library/digital-ids/new');
  await fillAndSave(name, number);
  await waitFor(() => expect(router.state.location.pathname).toBe('/library/digital-ids'));
}

/**
 * A row's "Set as default" button, or null when the row shows the Default badge instead. The row
 * is the smallest element around the name that holds either marker, so it does not depend on
 * whether the list draws a table or cards (that depends on the viewport). Retries while the list
 * reloads after a write.
 */
async function setAsDefaultButton(name: string): Promise<HTMLElement | null> {
  let result: HTMLElement | null = null;
  await waitFor(() => {
    let el: HTMLElement | null = screen.getByText(name);
    while (el) {
      const button = within(el).queryByRole('button', { name: 'Set as default' });
      if (button) {
        result = button;
        return;
      }
      if (within(el).queryByText('Default')) {
        result = null;
        return;
      }
      el = el.parentElement;
    }
    throw new Error(`No row for ${name} yet`);
  });
  return result;
}

describe('Digital IDs: default flow', () => {
  beforeEach(async () => {
    const meta = newProjectMeta('Test');
    hoisted.projectId = meta.projectId;
    await hoisted.store.seedProject({ meta });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('first ID is the default, Set as default moves it, deleting the default leaves none', async () => {
    const router = renderApp('/library/digital-ids');
    await addId(router, 'Home', '2351234');
    await screen.findByText('Home', {}, { timeout: 5000 });
    expect(await setAsDefaultButton('Home')).toBeNull();

    await addId(router, 'Club', '2351235');
    await waitFor(async () => expect(await setAsDefaultButton('Club')).not.toBeNull());
    expect(await setAsDefaultButton('Home')).toBeNull();

    fireEvent.click((await setAsDefaultButton('Club'))!);
    await waitFor(async () => expect(await setAsDefaultButton('Home')).not.toBeNull());
    expect(await setAsDefaultButton('Club')).toBeNull();
    const stored = await hoisted.store.listOwnDigitalIds(hoisted.projectId);
    expect(stored.filter((row) => row.isDefault).map((row) => row.name)).toEqual(['Club']);

    // Delete the default (not in use): the protocol is left with none, and the page says so.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const club = stored.find((row) => row.name === 'Club')!;
    await router.navigate(`/library/digital-ids/${club.id}`);
    fireEvent.click(await screen.findByRole('button', { name: /^Delete/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/library/digital-ids'));
    await waitFor(() => expect(screen.queryByText('Club')).toBeNull());
    expect(await screen.findByText(/No default DMR ID\./)).toBeInTheDocument();
    await waitFor(async () => {
      const left = await hoisted.store.listOwnDigitalIds(hoisted.projectId);
      expect(left.map((row) => [row.name, row.isDefault])).toEqual([['Home', false]]);
    });
  });

  it('refuses a duplicate number in the editor', async () => {
    const router = renderApp('/library/digital-ids');
    await addId(router, 'Home', '2351234');
    await router.navigate('/library/digital-ids/new');
    // The editor checks against the library it has loaded: wait for its message before Save.
    await fillAndSave('Again', '2351234', async () => {
      expect(await screen.findByText(/already in Digital IDs/)).toBeInTheDocument();
    });
    expect(await screen.findByText(/already in Digital IDs/)).toBeInTheDocument();
    expect(await hoisted.store.listOwnDigitalIds(hoisted.projectId)).toHaveLength(1);
  });

  it('an ID that a channel uses cannot be deleted, and its protocol is locked', async () => {
    const store = hoisted.store;
    const used = { ...newOwnDigitalId(hoisted.projectId), name: 'Used', number: 2351234 };
    await store.putOwnDigitalId({ ...used, isDefault: false }, null);
    const channel = newChannel(hoisted.projectId, 'Local');
    const profile: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 1,
      ownDigitalIdId: used.id,
      contactRef: null,
      rxGroupListId: null,
    };
    await store.putChannel({ ...channel, modeProfiles: [profile] }, null);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const router = renderApp(`/library/digital-ids/${used.id}`);
    fireEvent.click(await screen.findByRole('button', { name: /^Delete/ }));
    expect(await screen.findByText(/Delete blocked/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/library/digital-ids/${used.id}`);
    expect(await store.listOwnDigitalIds(hoisted.projectId)).toHaveLength(1);
    expect(screen.getByText('Channels use this ID, so its protocol is fixed.')).toBeInTheDocument();
  });
});
