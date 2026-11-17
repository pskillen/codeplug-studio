import type { DecodedChange } from '@integrations/radio-io/debugCompare/index.ts';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DecodedChanges } from './DecodedChanges.tsx';

const changes: DecodedChange[] = [
  {
    section: 'Settings',
    record: 'Radio settings',
    label: 'Volume',
    kind: 'changed',
    a: '3',
    b: '4',
    address: 0x1a2b,
  },
  {
    section: 'Settings',
    record: 'Radio settings',
    label: 'Password',
    kind: 'changed',
    sensitive: true,
  },
  { section: 'Channels', record: 'Slot 2 · Simplex', label: 'RX', kind: 'added', b: '145.5' },
];

function Harness({ list }: { list: readonly DecodedChange[] | undefined }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <MantineProvider>
      <DecodedChanges
        changes={list}
        notCaptured={2}
        revealed={revealed}
        onToggleReveal={() => setRevealed(!revealed)}
      />
    </MantineProvider>
  );
}

describe('DecodedChanges', () => {
  it('groups by section and shows A to B with the address in hex', () => {
    render(<Harness list={changes} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText(/Radio settings · Volume: 3 → 4 · 0x00001A2B/)).toBeInTheDocument();
    expect(screen.getByText(/Slot 2 · Simplex · RX: — → 145.5/)).toBeInTheDocument();
    expect(screen.getByText(/Not captured on at least one side: 2 values/)).toBeInTheDocument();
  });

  it('keeps a changed password as just "changed" and has a Show control', () => {
    render(<Harness list={changes} />);
    expect(screen.getByText('Radio settings · Password: changed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show/i }));
    expect(screen.getByText(/Password values are shown/)).toBeInTheDocument();
  });

  it('says so when decoded changes are unavailable or there are none', () => {
    const { unmount } = render(<Harness list={undefined} />);
    expect(screen.getByText(/unavailable for these captures/)).toBeInTheDocument();
    unmount();
    render(<Harness list={[]} />);
    expect(screen.getByText('No decoded changes.')).toBeInTheDocument();
  });
});
