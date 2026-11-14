import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { hashUv5rMiniDebugSpans } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import DebugUv5rMiniPage from './DebugUv5rMiniPage.tsx';
import { uv5rMiniDebugReadStore } from './uv5rMiniDebugReads.ts';

vi.mock('@integrations/platform/isNativeApp.ts', () => ({ isNativeApp: vi.fn(() => false) }));

vi.mock('@integrations/download/browserDownload.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/download/browserDownload.ts')>()),
  downloadZip: vi.fn(),
}));

function addRead(decoded: Uint8Array, store = uv5rMiniDebugReadStore) {
  store.add({
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
    // The channel view under the compare: 0x0100 is slot 9's first RX frequency byte.
    expect(screen.getByTestId('uv5r-mini-channel-diff')).toBeTruthy();
    expect(
      screen.getByText(
        'Slot 9: RX frequency changed; unmodelled bytes and bits of +0x0C..+0x13 unchanged',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Slot 248 (0x1EE0–0x1EFF, channel data kept apart): identical'),
    ).toBeTruthy();
    // No write or restore control anywhere on the page.
    expect(screen.queryByRole('button', { name: /write|restore/i })).toBeNull();
    // The calibration viewer is on the page and adds no download, export or copy: the zip stays the only one.
    expect(screen.getByTestId('uv5r-mini-calibration')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /download|export|save|copy/i })).toHaveLength(1);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(document.querySelector('[download]')).toBeNull();
  });
});

describe('DebugUv5rMiniPage in the Android app (#1680)', () => {
  afterEach(async () => {
    const { isNativeApp } = await import('@integrations/platform/isNativeApp.ts');
    vi.mocked(isNativeApp).mockReturnValue(false);
  });

  it('offers the read, the compare and the calibration view, with no download and no write', async () => {
    const { isNativeApp } = await import('@integrations/platform/isNativeApp.ts');
    vi.mocked(isNativeApp).mockReturnValue(true);
    const a = new Uint8Array(0x10000);
    const b = a.slice();
    b[0x0100] = 0x01;
    addRead(a);
    addRead(b);
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <DebugUv5rMiniPage />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Not available in the Android app')).toBeNull();
    expect(screen.getByRole('button', { name: 'Full read' })).toBeTruthy();
    expect(screen.getByText(/one attached cable that matches the Mini/)).toBeTruthy();
    expect(screen.getByText("Saving the reads isn't available in the Android app")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /write|restore/i })).toBeNull();
    expect(screen.getByText('The reads differ outside the skipped windows')).toBeTruthy();
    expect(screen.getByTestId('uv5r-mini-calibration')).toBeTruthy();
    // Nothing to download, so leaving is not blocked.
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('DebugUv5rMiniPage leave warning', () => {
  // The store lives as long as the module, so each case loads a fresh page and store.
  beforeEach(() => {
    vi.resetModules();
  });

  async function renderFresh() {
    const page = await import('./DebugUv5rMiniPage.tsx');
    const reads = await import('./uv5rMiniDebugReads.ts');
    const { DesignSystemV2Provider: Provider } = await import('@app/components/v2/index.ts');
    const Page = page.default;
    render(
      <MemoryRouter>
        <Provider>
          <Page />
        </Provider>
      </MemoryRouter>,
    );
    return reads.uv5rMiniDebugReadStore;
  }

  function leaveIsBlocked(): boolean {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('does not warn with no reads', async () => {
    await renderFresh();
    expect(leaveIsBlocked()).toBe(false);
  });

  it('warns while reads are not downloaded, and stops after Download all', async () => {
    const store = await renderFresh();
    const { act } = await import('@testing-library/react');
    act(() => addRead(new Uint8Array(0x10000), store));
    expect(leaveIsBlocked()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Download all (1)' }));
    const { downloadZip } = await import('@integrations/download/browserDownload.ts');
    expect(downloadZip).toHaveBeenCalledTimes(1);
    expect(leaveIsBlocked()).toBe(false);
  });
});
