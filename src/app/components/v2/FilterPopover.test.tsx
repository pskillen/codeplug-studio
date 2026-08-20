import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import FilterPopover, { type FilterPopoverTab } from './FilterPopover.tsx';

const TABS: FilterPopoverTab<'bands' | 'zones'>[] = [
  { value: 'bands', label: 'Bands' },
  { value: 'zones', label: 'Zones' },
];

function Harness({ onDone, activeCount }: { onDone?: () => void; activeCount?: number }) {
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<'bands' | 'zones'>('bands');

  return (
    <DesignSystemV2Provider>
      <FilterPopover
        triggerLabel="Filters"
        opened={opened}
        onOpenChange={setOpened}
        activeCount={activeCount}
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        footer={<div>Simplex/Split</div>}
        onDone={onDone}
      >
        {tab === 'bands' ? <div>2m chip</div> : <div>Home Shack chip</div>}
      </FilterPopover>
    </DesignSystemV2Provider>
  );
}

describe('FilterPopover', () => {
  it('opens on trigger click and shows the active tab panel plus footer', async () => {
    render(<Harness />);

    expect(screen.queryByText('2m chip')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));

    expect(await screen.findByText('2m chip')).toBeInTheDocument();
    expect(screen.getByText('Simplex/Split')).toBeInTheDocument();
  });

  it('switches tab panel content on tab change, keeping the footer visible', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    await screen.findByText('2m chip');

    fireEvent.click(screen.getByText('Zones'));

    await waitFor(() => expect(screen.queryByText('2m chip')).not.toBeInTheDocument());
    expect(screen.getByText('Home Shack chip')).toBeInTheDocument();
    expect(screen.getByText('Simplex/Split')).toBeInTheDocument();
  });

  it('calls onDone and closes on Done click', async () => {
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    await screen.findByText('2m chip');

    fireEvent.click(screen.getByText('Done'));

    expect(onDone).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText('2m chip')).not.toBeInTheDocument());
  });

  it('shows an active-count badge only when count is set', () => {
    const { rerender } = render(<Harness activeCount={0} />);
    expect(screen.queryByText('3')).not.toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <FilterPopover
          triggerLabel="Filters"
          opened={false}
          onOpenChange={() => undefined}
          activeCount={3}
          tabs={TABS}
          activeTab="bands"
          onTabChange={() => undefined}
        >
          <div>content</div>
        </FilterPopover>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
