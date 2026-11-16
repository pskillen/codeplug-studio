import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { radioDebugDescriptors } from './descriptors.ts';
import { RT95_FIFTH_READ_CHANGED_ADDRESS, rt95FiveReads } from './rt95Archive.fixture.ts';

const descriptor = radioDebugDescriptors.find((d) => d.slug === 'rt95')!;

describe('RT95 Compare: summary and hex diff on five reads', () => {
  beforeEach(() => getDebugReadHistory(descriptor).clear());

  function open() {
    const store = getDebugReadHistory(descriptor);
    store.importArchives(rt95FiveReads());
    render(
      <MemoryRouter initialEntries={['/debug/radios/rt95']}>
        <DesignSystemV2Provider>
          <Routes>
            <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
          </Routes>
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
    // Labelled A to E in capture order.
    const entries = store.getSnapshot().entries;
    const ids = ['A', 'B', 'C', 'D', 'E'].map((l) => entries.find((e) => e.label === l)!.id);
    return { store, ids };
  }

  it('is amber for D vs E (the default pair) and names the changed row', () => {
    open();
    expect(screen.getByText('A and B differ')).toBeInTheDocument();
    expect(screen.getByText(/1 changed byte in 1 region/)).toBeInTheDocument();
    const row = `0x${(Math.floor(RT95_FIFTH_READ_CHANGED_ADDRESS / 16) * 16)
      .toString(16)
      .toUpperCase()
      .padStart(8, '0')}`;
    expect(screen.getByText(new RegExp(`Changed rows: ${row}`))).toBeInTheDocument();
    const hex = screen.getByRole('group', { name: 'Hex diff' });
    expect(hex.querySelector(`[data-row-address="${row}"] mark`)).not.toBeNull();
    expect(screen.getByRole('switch', { name: 'Only changed rows' })).toBeChecked();
  });

  it('is green Identical for every pair among A to D', () => {
    const { store, ids } = open();
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        act(() => store.setComparePair({ a: ids[i]!, b: ids[j]! }));
        expect(screen.getByText('Identical')).toBeInTheDocument();
        expect(screen.queryByText('A and B differ')).not.toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Only changed rows' })).not.toBeChecked();
      }
  });

  it('shows one strip line per read after the first, and a click sets the pair', () => {
    const { store, ids } = open();
    const strip = screen.getByRole('list', { name: 'Each read against the one before' });
    const lines = Array.from(strip.querySelectorAll('[role="listitem"]')).map((n) => n.textContent);
    expect(lines).toEqual([
      'B = A, identical',
      'C = B, identical',
      'D = C, identical',
      'E ≠ D, 1 byte',
    ]);
    fireEvent.click(screen.getByRole('listitem', { name: /^Compare B and C:/ }));
    expect(store.getSnapshot().comparePair).toEqual({ a: ids[1], b: ids[2] });
    expect(screen.getByText('Identical')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('listitem', { name: /^Compare D and E:/ }));
    expect(store.getSnapshot().comparePair).toEqual({ a: ids[3], b: ids[4] });
    expect(screen.getByText('A and B differ')).toBeInTheDocument();
  });
});
