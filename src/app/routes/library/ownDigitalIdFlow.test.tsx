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
import { MantineProvider } from '@mantine/core';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
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

import EntityEditorPage from './EntityEditorPage.tsx';
import DigitalIdsListPage from './lists/DigitalIdsListPage.tsx';

function renderApp(initial: string) {
  const router = createMemoryRouter(
    [
      { path: '/library/digital-ids', element: <DigitalIdsListPage /> },
      { path: '/library/:kind/:id', element: <EntityEditorPage /> },
    ],
    { initialEntries: [initial] },
  );
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
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

async function openNewId() {
  fireEvent.click(await screen.findByRole('button', { name: 'New Digital ID' }));
}

async function addId(name: string, number: string) {
  await openNewId();
  await fillAndSave(name, number);
  await screen.findByRole('link', { name });
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
    await addId('Home', '2351234');
    await screen.findByText('Home', {}, { timeout: 5000 });
    expect(await setAsDefaultButton('Home')).toBeNull();

    await addId('Club', '2351235');
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
    renderApp('/library/digital-ids');
    await addId('Home', '2351234');
    await openNewId();
    // The editor checks against the library it has loaded: wait for its message before Save.
    await fillAndSave('Again', '2351234', async () => {
      expect(await screen.findByText(/already in Digital IDs/)).toBeInTheDocument();
    });
    expect(await screen.findByText(/already in Digital IDs/)).toBeInTheDocument();
    expect(await hoisted.store.listOwnDigitalIds(hoisted.projectId)).toHaveLength(1);
  });

  it('validates and edits M17 callsigns, with a default independent of DMR', async () => {
    const router = renderApp('/library/digital-ids');
    await addId('Home', '2351234');
    await openNewId();
    fireEvent.click(await screen.findByRole('button', { name: 'M17' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Portable' } });
    const callsign = screen.getByLabelText('M17 callsign');
    const save = screen.getByRole('button', { name: 'Save Digital ID' });
    fireEvent.change(callsign, { target: { value: 'AB CD' } });
    expect(screen.getByText(/M17 callsign must be 1–9/)).toBeInTheDocument();
    fireEvent.click(save);
    expect(await hoisted.store.listOwnDigitalIds(hoisted.projectId)).toHaveLength(1);

    fireEvent.change(callsign, { target: { value: ' ab1cd/p ' } });
    expect(callsign).toHaveValue(' ab1cd/p ');
    fireEvent.blur(callsign);
    expect(callsign).toHaveValue('AB1CD/P');
    fireEvent.click(save);
    await waitFor(() => expect(router.state.location.pathname).toBe('/library/digital-ids'));
    const m17Section = within(await screen.findByRole('region', { name: 'M17 callsigns' }));
    expect(m17Section.getByText('AB1CD/P')).toBeInTheDocument();
    expect(m17Section.queryByText('Channels using')).toBeNull();
    expect(await setAsDefaultButton('Portable')).toBeNull();
    expect(await setAsDefaultButton('Home')).toBeNull();

    fireEvent.click(m17Section.getByRole('link', { name: 'Portable' }));
    const savedCallsign = await screen.findByLabelText('M17 callsign');
    expect(savedCallsign).toHaveValue('AB1CD/P');
    fireEvent.change(savedCallsign, { target: { value: ' ab1cd/m ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Digital ID' }));
    expect(await screen.findByText('AB1CD/M')).toBeInTheDocument();
    const rows = await hoisted.store.listOwnDigitalIds(hoisted.projectId);
    expect(rows.find((row) => row.protocol === 'm17')).toMatchObject({
      callsign: 'AB1CD/M',
      isDefault: true,
    });

    await openNewId();
    fireEvent.click(await screen.findByRole('button', { name: 'M17' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Duplicate' } });
    fireEvent.change(screen.getByLabelText('M17 callsign'), { target: { value: ' ab1cd/m ' } });
    expect(
      await screen.findByText('M17 callsign AB1CD/M is already in Digital IDs'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Digital ID' }));
    expect(await hoisted.store.listOwnDigitalIds(hoisted.projectId)).toHaveLength(2);
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
