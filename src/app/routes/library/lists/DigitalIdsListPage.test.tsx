import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Library, OwnDigitalId } from '@core/models/library.ts';

const state = vi.hoisted(() => ({ initial: [] as OwnDigitalId[] }));

vi.mock('../../../state/persistence.ts', () => ({ persistence: {} }));
vi.mock('../../../state/useLibrary.ts', async () => {
  const { emptyLibrary: empty } = await import('@core/domain/factories.ts');
  const React = await import('react');
  return {
    useLibrary: () => {
      const [ids, setIds] = React.useState(state.initial);
      const library: Library = { ...empty(), ownDigitalIds: ids };
      return {
        projectId: 'p',
        library,
        loading: false,
        reload: async () => {},
        deleteEntity: async () => ({ ok: true }),
        deleteAllDigitalContacts: async () => ({ ok: true }),
        setDefaultOwnDigitalId: async (id: string) => {
          const target = ids.find((r) => r.id === id)!;
          setIds(
            ids.map((r) => (r.protocol === target.protocol ? { ...r, isDefault: r.id === id } : r)),
          );
        },
      };
    },
  };
});

import DigitalIdsListPage from './DigitalIdsListPage.tsx';

function row(over: Partial<OwnDigitalId> & Pick<OwnDigitalId, 'id' | 'number'>): OwnDigitalId {
  return {
    projectId: 'p',
    revision: 1,
    updatedAt: '',
    name: '',
    protocol: 'dmr',
    isDefault: false,
    ...over,
  };
}

function renderPage() {
  const router = createMemoryRouter([{ path: '*', element: <DigitalIdsListPage /> }], {
    initialEntries: ['/library/digital-ids'],
  });
  return render(<RouterProvider router={router} />);
}

describe('DigitalIdsListPage', () => {
  it('shows the empty state with no IDs', () => {
    state.initial = [];
    renderPage();
    expect(
      screen.getByText('Add your DMR ID and, if you use NXDN, your NXDN ID.'),
    ).toBeInTheDocument();
  });

  it('warns about a protocol with IDs but no default, and names unnamed IDs by number', () => {
    state.initial = [row({ id: 'a', number: 2351234 })];
    renderPage();
    expect(
      screen.getByText(
        /No default DMR ID\. Channels set to Default use whatever DMR ID the radio already has/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('DMR 2351234')).toBeInTheDocument();
  });

  it('Set as default moves the Default badge and clears the warning', async () => {
    state.initial = [
      row({ id: 'a', number: 1, name: 'Home', isDefault: true }),
      row({ id: 'b', number: 2, name: 'Club' }),
    ];
    renderPage();
    const clubRow = screen.getByText('Club').closest('[role="row"], tr, div')!.parentElement!;
    fireEvent.click(within(clubRow).getByRole('button', { name: 'Set as default' }));
    // Club is now the default: Home offers the button instead.
    const homeRow = (await screen.findByText('Home')).closest(
      '[role="row"], tr, div',
    )!.parentElement!;
    expect(within(homeRow).getByRole('button', { name: 'Set as default' })).toBeInTheDocument();
    expect(screen.queryByText(/No default/)).not.toBeInTheDocument();
  });
});
