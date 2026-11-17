import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLibrary, newChannel } from '@core/domain/factories.ts';
import ZoneEditor from './ZoneEditor.tsx';

const mocks = vi.hoisted(() => ({
  putZone: vi.fn(),
  reload: vi.fn(),
}));

vi.mock('../../state/persistence.ts', () => ({ persistence: mocks }));
vi.mock('../../state/useLibrary.ts', () => ({
  useLibrary: () => ({ reload: mocks.reload }),
}));

function ZoneEditStub() {
  const { pathname, search } = useLocation();
  return <p data-testid="zone-edit">{`${pathname}${search}`}</p>;
}

function renderCreate(state?: unknown, library = emptyLibrary()) {
  const router = createMemoryRouter(
    [
      {
        path: '/library/zones/new',
        element: <ZoneEditor projectId="p" library={library} />,
      },
      { path: '/library/zones/:zoneId', element: <ZoneEditStub /> },
      { path: '/library/zones', element: <p>Zones list</p> },
    ],
    { initialEntries: [{ pathname: '/library/zones/new', state }] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  mocks.putZone.mockReset().mockResolvedValue({ ok: true });
  mocks.reload.mockReset().mockResolvedValue(undefined);
});

describe('ZoneEditor (new zone)', () => {
  it('has no member picker or find-in-list filter — members are added after saving', () => {
    renderCreate();
    expect(screen.queryByLabelText('Find in list')).not.toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
    expect(screen.getByText(/add members on the next page/i)).toBeInTheDocument();
  });

  it('saves an empty zone and opens its edit page on the add-members screen', async () => {
    renderCreate();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Glasgow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save zone' }));

    await waitFor(() => expect(screen.getByTestId('zone-edit')).toBeInTheDocument());
    expect(mocks.putZone).toHaveBeenCalledTimes(1);
    const [row, revision] = mocks.putZone.mock.calls[0];
    expect(row).toMatchObject({ name: 'Glasgow', members: [] });
    expect(revision).toBeNull();
    expect(mocks.reload).toHaveBeenCalled();
    expect(screen.getByTestId('zone-edit')).toHaveTextContent(
      `/library/zones/${row.id}?add=members`,
    );
  });

  it('keeps channels preselected on the channels list as members and skips the add screen', async () => {
    const library = emptyLibrary();
    library.channels = [
      { ...newChannel('p', 'One'), id: 'ch-1' },
      { ...newChannel('p', 'Two'), id: 'ch-2' },
    ];
    renderCreate({ initialChannelIds: ['ch-1', 'ch-2'] }, library);
    expect(screen.getByText(/2 channels selected on the channels list/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save zone' }));

    await waitFor(() => expect(screen.getByTestId('zone-edit')).toBeInTheDocument());
    const [row] = mocks.putZone.mock.calls[0];
    expect(row.members).toEqual([
      expect.objectContaining({ kind: 'channel', channelId: 'ch-1' }),
      expect.objectContaining({ kind: 'channel', channelId: 'ch-2' }),
    ]);
    expect(screen.getByTestId('zone-edit')).toHaveTextContent(`/library/zones/${row.id}`);
    expect(screen.getByTestId('zone-edit')).not.toHaveTextContent('add=members');
  });

  it('stays on the form and shows the error when the save fails', async () => {
    mocks.putZone.mockResolvedValue({ ok: false, reason: 'revision_conflict' });
    renderCreate();
    fireEvent.click(screen.getByRole('button', { name: 'Save zone' }));
    await waitFor(() => expect(screen.getByText(/changed elsewhere/)).toBeInTheDocument());
    expect(screen.queryByTestId('zone-edit')).not.toBeInTheDocument();
  });
});
