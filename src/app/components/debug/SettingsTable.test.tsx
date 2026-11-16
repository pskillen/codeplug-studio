import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsView } from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import SettingsTable from './SettingsTable.tsx';

const view = (over: Partial<SettingsView> = {}): SettingsView => ({
  status: { kind: 'ok' },
  summary: '3 of 3 fields captured',
  intro: 'A read-only view.',
  groups: [
    {
      id: 'a',
      label: 'Group A',
      rows: [
        { id: 'a1', label: 'Alpha', help: '0 off, 1 on', value: 'On', confidence: 'traced' },
        { id: 'a2', label: 'Beta', value: undefined, confidence: 'unknown' },
      ],
    },
    {
      id: 'b',
      label: 'Group B',
      rows: [
        {
          id: 'b1',
          label: 'Gamma',
          value: 'Wide',
          rawValue: 26,
          confidence: 'partially-traced',
          evidence: 'doc line 4',
          address: '0x00001000',
          raw: [0x1a],
          firmwareDefault: 'Narrow',
        },
        {
          id: 'b2',
          label: 'Secret',
          value: 'hunter2',
          confidence: 'traced',
          raw: [0x68, 0x75],
          sensitive: true,
        },
      ],
    },
  ],
  trailing: [
    {
      id: 't',
      title: 'Folded',
      rows: [{ id: 't1', label: 'Odd range', value: 'Not decoded', confidence: 'unused' }],
    },
  ],
  ...over,
});

function show(v: SettingsView, revealed = false, onToggle = () => {}) {
  return render(
    <MantineProvider>
      <DesignSystemV2Provider>
        <SettingsTable view={v} revealed={revealed} onToggleReveal={onToggle} />
      </DesignSystemV2Provider>
    </MantineProvider>,
  );
}

describe('SettingsTable', () => {
  it('draws summary, intro and one striped table per group with shared columns', () => {
    show(view());
    expect(screen.getByText('3 of 3 fields captured')).toBeInTheDocument();
    expect(screen.getByText('A read-only view.')).toBeInTheDocument();
    expect(screen.getByText('0 off, 1 on')).toBeInTheDocument();
    const cols = (name: string) =>
      Array.from(screen.getByRole('table', { name }).querySelectorAll('col'), (c) => c.style.width);
    // a row has a firmware default, so every group gets the Default column at the same widths
    expect(cols('Group A settings')).toEqual(['36%', '24%', '14%', '26%']);
    expect(cols('Group B settings')).toEqual(cols('Group A settings'));
    expect(screen.getAllByRole('columnheader', { name: 'Default' })).toHaveLength(2);
  });

  it('omits the Default column when no row has a default', () => {
    show(view({ groups: [view().groups[0]!] }));
    expect(screen.queryByRole('columnheader', { name: 'Default' })).toBeNull();
  });

  it('says Not captured in words and appends the raw code only to a non-numeric value', () => {
    show(view());
    expect(screen.getByText('Not captured')).toBeInTheDocument();
    expect(screen.getByText('Wide (26)')).toBeInTheDocument();
  });

  it('adds Address and Raw after Value with the raw toggle', () => {
    show(view());
    expect(screen.queryByRole('columnheader', { name: 'Address' })).toBeNull();
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    const heads = screen
      .getAllByRole('columnheader')
      .slice(0, 6)
      .map((h) => h.textContent);
    expect(heads).toEqual(['Setting', 'Value', 'Address', 'Raw', 'Default', 'Confidence']);
    expect(screen.getByText('0x00001000')).toBeInTheDocument();
    expect(screen.getByText('1A')).toBeInTheDocument();
  });

  it('hides sensitive rows until revealed and only offers the button when one is sensitive', () => {
    const onToggle = vi.fn();
    const { unmount } = show(view(), false, onToggle);
    expect(screen.getByText('Hidden (password)')).toBeInTheDocument();
    expect(screen.queryByText('hunter2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(onToggle).toHaveBeenCalled();
    unmount();
    const second = show(view(), true);
    expect(screen.getByText('hunter2')).toBeInTheDocument();
    second.unmount();
    show(view({ groups: [view().groups[0]!] }));
    expect(screen.queryByRole('button', { name: /password/ })).toBeNull();
  });

  it('folds trailing sections and opens them for a search match', () => {
    show(view());
    expect(screen.getByRole('button', { name: 'Folded' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    fireEvent.change(screen.getByPlaceholderText('Search settings'), {
      target: { value: 'odd' },
    });
    expect(screen.getByText('Odd range')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('searches the confidence badge text and the evidence', () => {
    show(view());
    const search = screen.getByPlaceholderText('Search settings');
    fireEvent.change(search, { target: { value: 'partly' } });
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).toBeNull();
    fireEvent.change(search, { target: { value: 'doc line' } });
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows the reason, never a default, when not captured or ambiguous', () => {
    const { unmount } = show(
      view({ status: { kind: 'not-captured', reason: 'No page was captured.' }, groups: [] }),
    );
    expect(screen.getByText('Not captured')).toBeInTheDocument();
    expect(screen.getByText(/No page was captured\./)).toBeInTheDocument();
    unmount();
    show(view({ status: { kind: 'ambiguous', reason: 'Two pages.' }, groups: [] }));
    expect(screen.getByText('Several pages, not decoded')).toBeInTheDocument();
  });
});
