import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelPlaceSearch from './ChannelPlaceSearch.tsx';

const searchPlaces = vi.fn();

vi.mock('@integrations/geocode/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/geocode/index.ts')>()),
  searchPlaces: (...args: unknown[]) => searchPlaces(...args),
}));

const centreOfIo64 = { lat: 54.5, lon: -7 };

function renderSearch(onPick = vi.fn(), nameQuery: string | null = 'Tandragee') {
  render(
    <DesignSystemV2Provider>
      <ChannelPlaceSearch nameQuery={nameQuery} near={centreOfIo64} onPick={onPick} />
    </DesignSystemV2Provider>,
  );
  return onPick;
}

describe('ChannelPlaceSearch', () => {
  beforeEach(() => {
    searchPlaces.mockReset();
  });

  it('searches the town from the channel name near the current position', async () => {
    searchPlaces.mockResolvedValue([
      { lat: 54.3525, lon: -6.4124, label: 'Tandragee, County Armagh', kind: 'village' },
    ]);
    renderSearch();

    fireEvent.click(screen.getByRole('button', { name: /Find “Tandragee” from the channel name/ }));

    expect(await screen.findByText('Tandragee, County Armagh')).toBeInTheDocument();
    expect(searchPlaces).toHaveBeenCalledWith('Tandragee', {
      near: centreOfIo64,
      mapboxToken: undefined,
    });
    expect(screen.getByText(/village · IO64TI · .* km from current position/)).toBeInTheDocument();
  });

  it('offers results and applies only the one picked', async () => {
    searchPlaces.mockResolvedValue([
      { lat: 54.3525, lon: -6.4124, label: 'Tandragee, County Armagh' },
      { lat: 54.1, lon: -6.9, label: 'Tandragee, County Monaghan' },
    ]);
    const onPick = renderSearch(vi.fn(), null);

    fireEvent.change(screen.getByRole('textbox', { name: 'Find a place' }), {
      target: { value: 'Tandragee' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const moveButtons = await screen.findAllByRole('button', { name: 'Move here' });
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.click(moveButtons[1]);
    expect(onPick).toHaveBeenCalledWith(54.1, -6.9, 'Tandragee, County Monaghan');
    expect(screen.getByRole('status')).toHaveTextContent('Moved to Tandragee, County Monaghan');
  });

  it('says when nothing matches', async () => {
    searchPlaces.mockResolvedValue([]);
    renderSearch();

    fireEvent.click(screen.getByRole('button', { name: /from the channel name/ }));
    expect(await screen.findByText('No places found for “Tandragee”.')).toBeInTheDocument();
  });
});
