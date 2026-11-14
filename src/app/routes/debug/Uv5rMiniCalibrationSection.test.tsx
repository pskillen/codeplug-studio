import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { hashUv5rMiniDebugSpans } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import Uv5rMiniCalibrationSection from './Uv5rMiniCalibrationSection.tsx';
import { hexRows } from './uv5rMiniHexRows.ts';
import { Uv5rMiniDebugReadStore } from './uv5rMiniDebugReads.ts';

/** Synthetic read: a pattern from the address, blank battery thresholds, an untraced tail of 0xFF. */
function syntheticRead(seed: number): Uint8Array {
  const read = new Uint8Array(0x10000);
  for (let i = 0; i < 0xf280; i++) read[i] = (i * 7 + seed) & 0xff;
  read.fill(0xff, 0xf280);
  read.fill(0xff, 0xf200, 0xf206);
  read[0xf216] = 5;
  return read;
}

function storeWith(...reads: Uint8Array[]) {
  const store = new Uv5rMiniDebugReadStore();
  for (const decoded of reads) {
    store.add({
      ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
      raw: decoded,
      decoded,
      spans: hashUv5rMiniDebugSpans(decoded),
    });
  }
  return store.getSnapshot().reads;
}

function renderSection(reads: ReturnType<typeof storeWith>) {
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <Uv5rMiniCalibrationSection reads={reads} />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

describe('Uv5rMiniCalibrationSection', () => {
  it('asks for a read when there is none', () => {
    renderSection([]);
    expect(screen.getByText('Take a read to view its calibration.')).toBeTruthy();
  });

  it('shows the newest read: PA bias charts, squelch, defaults, trim, text and hex', () => {
    renderSection(storeWith(syntheticRead(1), syntheticRead(2)));
    const section = screen.getByTestId('uv5r-mini-calibration');
    const s = within(section);
    expect(s.getByText(/Row order assumed: segment-major/)).toBeTruthy();
    expect(
      s.getByRole('img', { name: /PA bias, Segment 1: 130–175 MHz \(0xF000–0xF02F\)/ }),
    ).toBeTruthy();
    expect(s.getByRole('img', { name: /Segment 4: 400–550 MHz \(0xF090–0xF0BF\)/ })).toBeTruthy();
    expect(s.getByRole('img', { name: 'Squelch row 0xF100–0xF10F' })).toBeTruthy();
    expect(s.getAllByText('partly traced').length).toBeGreaterThan(0);
    expect(s.getByText('built-in defaults')).toBeTruthy();
    expect(s.getByText(/B: 0x05 \(5\), \+1 ppm/)).toBeTruthy();
    expect(s.getByText('CTCSS TX level')).toBeTruthy();
    expect(s.getByText('Region byte')).toBeTruthy();
    expect(s.getByText(/0xF280–0xFFFF all FF \(3456 bytes\)/)).toBeTruthy();
  });

  it('overlays a second read', () => {
    renderSection(storeWith(syntheticRead(1), syntheticRead(2)));
    fireEvent.click(screen.getByLabelText('Overlay (optional)', { selector: 'input' }));
    fireEvent.click(screen.getByRole('option', { name: /^A / }));
    const s = within(screen.getByTestId('uv5r-mini-calibration'));
    expect(s.getByText(/Read B solid, read A dashed/)).toBeTruthy();
    expect(s.getAllByText('Level 0 (A)').length).toBeGreaterThan(0);
    expect(s.getAllByText(/bytes differ/).length).toBeGreaterThan(0);
  });

  it('offers nothing to download, copy, export or send', () => {
    renderSection(storeWith(syntheticRead(1), syntheticRead(2)));
    const section = screen.getByTestId('uv5r-mini-calibration');
    expect(within(section).queryAllByRole('button')).toHaveLength(0);
    expect(within(section).queryAllByRole('link')).toHaveLength(0);
    expect(section.querySelector('a, [download]')).toBeNull();
  });
});

describe('hexRows', () => {
  it('collapses runs of one byte value and keeps mixed rows', () => {
    const bytes = new Uint8Array(64).fill(0xff);
    bytes[0] = 1;
    expect(hexRows(0xf000, bytes)).toEqual([
      '0xF000  01 FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF',
      '0xF010–0xF03F  all FF (48 bytes)',
    ]);
    expect(hexRows(0xf215, Uint8Array.of(0xaa))).toEqual(['0xF215  AA']);
    // Rows end on 16-byte boundaries, so an unaligned range collapses from the first full row.
    expect(hexRows(0xf21f, new Uint8Array(0x31).fill(0xff))).toEqual([
      '0xF21F  FF',
      '0xF220–0xF24F  all FF (48 bytes)',
    ]);
  });
});
