import {
  diffBytes,
  type ByteComparison,
  type CompareSection,
} from '@integrations/radio-io/debugCompare/index.ts';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompareSummary } from './CompareSummary.tsx';

const compared = (id: string, a: Uint8Array, b: Uint8Array, base = 0): CompareSection => ({
  id,
  label: id.toUpperCase(),
  kind: 'compared',
  base,
  a,
  b,
  ...diffBytes(a, b, base),
});
const other = (kind: CompareSection['kind']): CompareSection => ({
  id: kind,
  label: kind,
  kind,
  reason: 'because',
  base: 0,
  changed: 0,
  missing: 0,
  runs: [],
  runsTruncated: false,
});
function view(comparison: ByteComparison, onJump = vi.fn()) {
  render(
    <MantineProvider>
      <CompareSummary comparison={comparison} onJump={onJump} />
    </MantineProvider>,
  );
  return onJump;
}
const zeros = (n: number, ...changed: number[]) => {
  const out = new Uint8Array(n);
  for (const i of changed) out[i] = 9;
  return out;
};

describe('CompareSummary', () => {
  it('is green Identical when every compared region matches, and lists what was not compared', () => {
    view({ sections: [compared('x', zeros(8), zeros(8)), other('incomparable')] });
    expect(screen.getByText('Identical')).toBeInTheDocument();
    expect(screen.getByText(/1 region, 8 bytes/)).toBeInTheDocument();
    expect(screen.getByText(/Not compared: incomparable \(incomparable\)/)).toBeInTheDocument();
  });

  it('is amber with the counts and the changed row addresses', () => {
    view({
      sections: [
        compared('x', zeros(0x200), zeros(0x200, 0x123, 0x1a0)),
        compared('y', zeros(4), zeros(4)),
      ],
    });
    expect(screen.getByText('A and B differ')).toBeInTheDocument();
    expect(screen.getByText(/2 changed bytes in 1 region/)).toBeInTheDocument();
    expect(screen.getByText(/Changed rows: 0x00000120, 0x000001A0/)).toBeInTheDocument();
    expect(screen.getByText('2 bytes')).toBeInTheDocument();
  });

  it('is grey, never green, when nothing could be compared', () => {
    view({ sections: [other('incomparable'), other('skipped')] });
    expect(screen.getByText('Nothing comparable')).toBeInTheDocument();
    expect(screen.queryByText('Identical')).not.toBeInTheDocument();
  });

  it('jumps to the region when its row is chosen', () => {
    const onJump = view({
      sections: [compared('x', zeros(16), zeros(16, 1)), compared('y', zeros(16), zeros(16))],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show Y in the hex diff' }));
    expect(onJump).toHaveBeenCalledWith('y');
    fireEvent.click(screen.getByText('1 byte'));
    expect(onJump).toHaveBeenLastCalledWith('x');
  });
});
