import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HexSource } from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import HexDump, { hexDumpLines } from './HexDump.tsx';

const bytes = new Uint8Array(600).map((_, i) => i & 0xff);
const src: HexSource = { id: 'a', label: 'Page A', address: 0x1000, bytes };

describe('HexDump', () => {
  it('formats address, hex and ascii in 16-byte rows', () => {
    const lines = hexDumpLines({ ...src, bytes: new Uint8Array([0x41, 0x42, 0]) }, 0, false, false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^0x1000 {2}41 42 00 +AB\.$/);
  });

  it('pages by 256 bytes', () => {
    render(
      <DesignSystemV2Provider>
        <HexDump sources={[src]} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Hexadecimal bytes').textContent).toContain('0x1100');
  });

  it('masks sensitive ranges until revealed', () => {
    const s = { ...src, sensitive: [{ start: 0x1000, length: 2 }] };
    expect(hexDumpLines(s, 0, false, false)[0]).toContain('•• •• 02');
    expect(hexDumpLines(s, 0, true, false)[0]).toContain('00 01 02');
  });

  it('collapses runs of identical rows when asked', () => {
    const s: HexSource = { id: 'z', label: 'Z', address: 0, bytes: new Uint8Array(96).fill(0xff) };
    expect(hexDumpLines(s, 0, false, true)).toEqual(['0x0000–0x005F  all FF (96 bytes)']);
    expect(hexDumpLines(s, 0, false, false)).toHaveLength(6);
  });

  it('shows a source select only when there are several', () => {
    const { rerender } = render(
      <DesignSystemV2Provider>
        <HexDump sources={[src]} />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByLabelText('Source')).toBeNull();
    rerender(
      <DesignSystemV2Provider>
        <HexDump sources={[src, { ...src, id: 'b', label: 'Page B' }]} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByLabelText('Source')).toBeInTheDocument();
  });
});
