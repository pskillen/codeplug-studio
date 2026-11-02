import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function renderLayout(props: Partial<ComponentProps<typeof ListMapLayout>> = {}) {
  return render(
    <DesignSystemV2Provider>
      <ListMapLayout
        title="Channels"
        head={<h1>Header</h1>}
        notices={<p>a notice</p>}
        controls={<input aria-label="Filter" />}
        list={<p>the list</p>}
        map={<div data-testid="map" />}
        mapExtras={<span>extras</span>}
        controlsSummary={<b>12 channels · 2 filters</b>}
        controlsAction={<button type="button">New</button>}
        {...props}
      />
    </DesignSystemV2Provider>,
  );
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('ListMapLayout', () => {
  it('desktop: header, controls, list and map side by side without a sheet or panes', () => {
    setMobile(false);
    renderLayout();
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter')).toBeInTheDocument();
    expect(screen.getByText('the list')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Results controls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show map' })).not.toBeInTheDocument();
    expect(screen.queryByText('12 channels · 2 filters')).not.toBeInTheDocument();
  });

  it('desktop: notices, then controls, then the list', () => {
    setMobile(false);
    renderLayout();
    const notice = screen.getByText('a notice');
    const filter = screen.getByLabelText('Filter');
    const list = screen.getByText('the list');
    expect(notice.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filter.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mobile: renders both swipe panes by default, with no list-in-sheet mode', () => {
    setMobile(true);
    const { container } = renderLayout();
    expect(container.querySelector('[data-swipe-layout]')).not.toBeNull();
    expect(screen.getByText('the list')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
    // The list lives in the list pane, not the controls sheet.
    const sheet = screen.getByRole('region', { name: 'Results controls' });
    expect(sheet).not.toContainElement(screen.getByText('the list'));
  });

  it('mobile: the controls sheet holds head, extras and controls, and starts at peek with the summary and action', () => {
    setMobile(true);
    renderLayout();
    const sheet = screen.getByRole('region', { name: 'Results controls' });
    expect(sheet).toHaveAttribute('data-snap', 'peek');
    expect(within(sheet).getByText('12 channels · 2 filters')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(within(sheet).getByText('Header')).toBeInTheDocument();
    expect(within(sheet).getByText('extras')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Filter')).toBeInTheDocument();
    // Notices stay with the list.
    expect(sheet).not.toContainElement(screen.getByText('a notice'));
  });

  it('mobile: tapping the summary or the backdrop toggles the sheet', () => {
    setMobile(true);
    renderLayout();
    const sheet = screen.getByRole('region', { name: 'Results controls' });
    fireEvent.click(screen.getByRole('button', { name: '12 channels · 2 filters' }));
    expect(sheet).toHaveAttribute('data-snap', 'half');
    fireEvent.click(screen.getByRole('button', { name: 'Close results controls' }));
    expect(sheet).toHaveAttribute('data-snap', 'peek');
    expect(
      screen.queryByRole('button', { name: 'Close results controls' }),
    ).not.toBeInTheDocument();
  });

  it('mobile: initialControlsSnap opens the sheet, and a controlled snap is honoured', () => {
    setMobile(true);
    const onChange = vi.fn();
    renderLayout({ controlsSnap: 'full', onControlsSnapChange: onChange });
    const sheet = screen.getByRole('region', { name: 'Results controls' });
    expect(sheet).toHaveAttribute('data-snap', 'full');
    fireEvent.click(screen.getByRole('button', { name: 'Close results controls' }));
    expect(onChange).toHaveBeenCalledWith('peek');
  });

  it('mobile: no sheet when there is nothing to put in it', () => {
    setMobile(true);
    renderLayout({
      head: undefined,
      notices: undefined,
      controls: undefined,
      mapExtras: undefined,
      controlsSummary: undefined,
      controlsAction: undefined,
    });
    expect(screen.queryByRole('region', { name: 'Results controls' })).not.toBeInTheDocument();
  });

  it('mobile: the toggle and peek strips switch panes', () => {
    setMobile(true);
    renderLayout();
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

  it('mobile: one grab handle button follows the active pane', () => {
    setMobile(true);
    renderLayout();
    const handle = screen.getByRole('button', { name: 'Show map' });
    expect(handle.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /Show (map|list)/ })).toHaveLength(1);
    fireEvent.click(handle);
    expect(screen.getAllByRole('button', { name: /Show (map|list)/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Show list' })).toBeInTheDocument();
  });

  it('mobile: an aria-hidden dead zone sits under the handle and swallows clicks', () => {
    setMobile(true);
    const { container } = renderLayout();
    const dead = container.querySelector('[data-swipe-dead]');
    expect(dead).not.toBeNull();
    expect(dead).toHaveAttribute('aria-hidden', 'true');
    expect(dead?.querySelector('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show map' }));
    expect(container.querySelectorAll('[data-swipe-dead]')).toHaveLength(1);
  });
});
