import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import ListMapLayout from './ListMapLayout.tsx';

const realMatchMedia = window.matchMedia;

function setMobile(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function renderLayout(initialSnap?: 'peek' | 'half' | 'full', mobile?: 'sheet' | 'swipe') {
  return render(
    <DesignSystemV2Provider>
      <ListMapLayout
        title="Channels"
        head={<h1>Header</h1>}
        list={<p>the list</p>}
        map={<div data-testid="map" />}
        mapExtras={<span>extras</span>}
        sheetHeader={<b>12 rows</b>}
        initialSnap={initialSnap}
        mobile={mobile}
      />
    </DesignSystemV2Provider>,
  );
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('ListMapLayout', () => {
  it('desktop: shows header, list and map side by side without a sheet', () => {
    setMobile(false);
    renderLayout();
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('the list')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Results' })).not.toBeInTheDocument();
  });

  it('mobile: map under a sheet, and the toggle only snaps the sheet', () => {
    setMobile(true);
    renderLayout();
    const sheet = screen.getByRole('region', { name: 'Results' });
    expect(sheet).toHaveAttribute('data-snap', 'half');
    expect(screen.getByTestId('map')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(sheet).toHaveAttribute('data-snap', 'full');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(sheet).toHaveAttribute('data-snap', 'peek');
  });

  it('mobile: starts at full when told there is nothing on the map', () => {
    setMobile(true);
    renderLayout('full');
    expect(screen.getByRole('region', { name: 'Results' })).toHaveAttribute('data-snap', 'full');
  });

  it('mobile swipe (experimental): renders both panes, no sheet, and the toggle and peek strips switch', () => {
    setMobile(true);
    renderLayout(undefined, 'swipe');
    expect(screen.queryByRole('region', { name: 'Results' })).not.toBeInTheDocument();
    expect(screen.getByText('the list')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
    // List is the default pane: the map is covered by its peek button.
    expect(screen.queryByRole('button', { name: 'Show list' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('button', { name: 'Show list' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show map' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show list' }));
    expect(screen.getByRole('button', { name: 'Show map' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show map' }));
    expect(screen.getByRole('button', { name: 'Show list' })).toBeInTheDocument();
  });

  it('mobile swipe: one grab handle button follows the active pane', () => {
    setMobile(true);
    renderLayout(undefined, 'swipe');
    const handle = screen.getByRole('button', { name: 'Show map' });
    expect(handle.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /Show (map|list)/ })).toHaveLength(1);
    fireEvent.click(handle);
    expect(screen.getAllByRole('button', { name: /Show (map|list)/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Show list' })).toBeInTheDocument();
  });

  it('mobile swipe: an aria-hidden dead zone sits under the handle and swallows clicks', () => {
    setMobile(true);
    const { container } = renderLayout(undefined, 'swipe');
    const dead = container.querySelector('[data-swipe-dead]');
    expect(dead).not.toBeNull();
    expect(dead).toHaveAttribute('aria-hidden', 'true');
    expect(dead?.querySelector('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show map' }));
    expect(container.querySelectorAll('[data-swipe-dead]')).toHaveLength(1);
  });

  it('desktop ignores mobile="swipe"', () => {
    setMobile(false);
    renderLayout(undefined, 'swipe');
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show map' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show list' })).not.toBeInTheDocument();
  });
});
