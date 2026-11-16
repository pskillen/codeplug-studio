import {
  diffDecoded,
  type DecodedDomain,
  type DecodedSnapshot,
} from '@integrations/radio-io/debugCompare/index.ts';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ALL_CATEGORIES, DecodedDiffView, identityText } from './DecodedDiffView.tsx';

const ch = (
  key: string,
  slot: number,
  identity: { callsign?: string; name?: string },
  rx: string,
  tx = '1',
) => ({
  key,
  slot,
  identity,
  fields: [
    { id: 'name', label: 'Name', value: identity.name },
    { id: 'rx', label: 'RX', value: rx },
    { id: 'tx', label: 'TX', value: tx },
  ],
});
const snapshot = (rx: string, name = 'Glasgow', pw = '1111'): DecodedSnapshot => [
  {
    id: 'channels',
    label: 'Channels',
    occupancyCaptured: true,
    records: [
      ch('c1', 1, { callsign: 'GB3GL', name }, rx),
      ch('c2', 2, { name: 'Simplex' }, '145.5'),
    ],
  } as DecodedDomain,
  {
    id: 'settings',
    label: 'Settings',
    occupancyCaptured: true,
    records: [
      {
        key: 's',
        identity: { name: 'Settings' },
        fields: [
          { id: 'beep', label: 'Beep', value: 'On' },
          { id: 'pw', label: 'Password', value: pw, sensitive: true },
        ],
      },
    ],
  },
];

function Harness({
  a,
  b,
  revealed = false,
}: {
  a: DecodedSnapshot;
  b: DecodedSnapshot;
  revealed?: boolean;
}) {
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [only, setOnly] = useState(true);
  const [shown, setShown] = useState(revealed);
  return (
    <MantineProvider>
      <DecodedDiffView
        diff={diffDecoded(a, b, { revealSensitive: shown })}
        category={category}
        onCategoryChange={setCategory}
        onlyChanges={only}
        onOnlyChangesChange={setOnly}
        revealed={shown}
        onToggleReveal={() => setShown((v) => !v)}
      />
    </MantineProvider>
  );
}

describe('DecodedDiffView', () => {
  it('shows only changed records and changed fields by default', () => {
    render(<Harness a={snapshot('145.0')} b={snapshot('146.0')} />);
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Slot 1 · GB3GL Glasgow',
    ]);
    const rec = screen.getByRole('group', { name: /GB3GL/ });
    expect(within(rec).getByText('RX')).toBeInTheDocument();
    expect(within(rec).queryByText('TX')).not.toBeInTheDocument();
    expect(within(rec).getByText('146.0', { selector: 'mark' })).toBeInTheDocument();
  });

  it('shows unchanged records and every field with Only changes off', () => {
    render(<Harness a={snapshot('145.0')} b={snapshot('146.0')} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Only changes' }));
    expect(screen.getByRole('group', { name: /Simplex/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: /GB3GL/ })).getByText('TX'),
    ).toBeInTheDocument();
  });

  it('puts the callsign before the name, and the name alone without one', () => {
    expect(identityText({ callsign: 'GB3GL', name: 'Glasgow' })).toBe('GB3GL Glasgow');
    expect(identityText({ name: 'Simplex' })).toBe('Simplex');
    expect(identityText({})).toBe('');
  });

  it('reads a rename as (was ...)', () => {
    render(<Harness a={snapshot('145.0', 'Glasgow')} b={snapshot('145.0', 'Glasgow 2')} />);
    expect(
      screen.getByRole('group', { name: 'Slot 1 · GB3GL Glasgow 2 (was GB3GL Glasgow)' }),
    ).toBeInTheDocument();
  });

  it('filters by category', () => {
    render(<Harness a={snapshot('145.0', 'G', '1')} b={snapshot('146.0', 'G', '2')} />);
    expect(screen.getAllByRole('group').length).toBe(2);
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByRole('option', { name: 'Settings' }));
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Settings',
    ]);
  });

  it('says a password changed without values until Show password', () => {
    render(<Harness a={snapshot('1', 'G', '1111')} b={snapshot('1', 'G', '2222')} />);
    const rec = screen.getByRole('group', { name: 'Settings' });
    expect(rec).toHaveTextContent('changed');
    expect(rec.textContent).not.toMatch(/1111|2222/);
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    const shown = screen.getByRole('group', { name: 'Settings' });
    expect(shown).toHaveTextContent('1111');
    expect(shown).toHaveTextContent('2222');
  });

  it('says Not captured for an unavailable value, never zero', () => {
    const a: DecodedSnapshot = [
      {
        id: 'd',
        label: 'D',
        occupancyCaptured: true,
        records: [{ key: 'k', identity: { name: 'K' }, fields: [{ id: 'x', label: 'X' }] }],
      },
    ];
    const b: DecodedSnapshot = [
      {
        id: 'd',
        label: 'D',
        occupancyCaptured: true,
        records: [
          { key: 'k', identity: { name: 'K' }, fields: [{ id: 'x', label: 'X', value: '0' }] },
        ],
      },
    ];
    render(<Harness a={a} b={b} />);
    expect(screen.getByText('Not captured')).toBeInTheDocument();
  });
});
