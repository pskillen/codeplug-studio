import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { hashUv5rMiniDebugSpans } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import DebugUv5rMiniPage from './DebugUv5rMiniPage.tsx';
import { uv5rMiniDebugReadStore } from './uv5rMiniDebugReads.ts';

function addRead(decoded: Uint8Array) {
  uv5rMiniDebugReadStore.add({
    ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
    raw: decoded,
    decoded,
    spans: hashUv5rMiniDebugSpans(decoded),
  });
}

describe('DebugUv5rMiniPage', () => {
  it('lists the reads, offers the zip with its calibration note, and compares the two newest', () => {
    const a = new Uint8Array(0x10000);
    const b = a.slice();
    b[0x0100] = 0x01; // compared span
    b[0x8800] = 0x01; // log sector: skipped
    addRead(a);
    addRead(b);
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <DebugUv5rMiniPage />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Download all (2)' })).toBeTruthy();
    expect(screen.getByText('2 reads not downloaded')).toBeTruthy();
    expect(screen.getByText(/including the radio.s calibration/)).toBeTruthy();
    expect(screen.getByText('The reads differ outside the skipped windows')).toBeTruthy();
    expect(screen.getByText('0x0100')).toBeTruthy();
    expect(screen.queryByText('0x8800')).toBeNull();
    // No write or restore control anywhere on the page.
    expect(screen.queryByRole('button', { name: /write|restore/i })).toBeNull();
  });
});
