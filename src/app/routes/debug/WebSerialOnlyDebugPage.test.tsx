import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { isNativeApp } from '@integrations/platform/isNativeApp.ts';

import DebugD890EraseProbePage from './DebugD890EraseProbePage.tsx';
import DebugSerialReopenPage from './DebugSerialReopenPage.tsx';
import DebugUv5rMiniPage from './DebugUv5rMiniPage.tsx';
import WebSerialOnlyDebugPage from './WebSerialOnlyDebugPage.tsx';

vi.mock('@integrations/platform/isNativeApp.ts', () => ({ isNativeApp: vi.fn(() => false) }));

const NOTICE = 'Not available in the Android app';

function renderPage(Page: ComponentType) {
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <Page />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

const WEB_SERIAL_PAGES: [string, ComponentType][] = [
  ['Serial reopen timing', DebugSerialReopenPage],
];

/** Every radio page, including those that also run in the Android app (#1680). */
const RADIO_PAGES: [string, ComponentType][] = [
  ...WEB_SERIAL_PAGES,
  ['AT-D890UV erase-unit probe', DebugD890EraseProbePage],
  ['UV-5R Mini full read', DebugUv5rMiniPage],
];

describe('AT-D890UV erase-unit probe in the Android app (#1680)', () => {
  afterEach(() => vi.mocked(isNativeApp).mockReturnValue(false));

  it('offers only the read-only link-speed pass, with the notice for the rest', () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    renderPage(DebugD890EraseProbePage);
    expect(screen.getByRole('heading', { name: 'AT-D890UV erase-unit probe' })).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Profile link speed (read-only)',
    ]);
    expect(screen.queryByText('This writes to the radio')).toBeNull();
    expect(screen.queryByText('Raw memory-region export (read-only)')).toBeNull();
  });

  it('keeps the writing passes and the exports in a browser', () => {
    renderPage(DebugD890EraseProbePage);
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getByText('This writes to the radio')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Run pass 0/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export all/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Profile link speed (read-only)' })).toBeTruthy();
  });
});

describe('WebSerialOnlyDebugPage (#1673)', () => {
  afterEach(() => vi.mocked(isNativeApp).mockReturnValue(false));

  it('renders the page unchanged in a browser', () => {
    render(
      <WebSerialOnlyDebugPage title="Tool">
        <p>The tool</p>
      </WebSerialOnlyDebugPage>,
    );
    expect(screen.getByText('The tool')).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it.each(WEB_SERIAL_PAGES)(
    '%s shows the notice and no serial controls in the Android app',
    (title, Page) => {
      vi.mocked(isNativeApp).mockReturnValue(true);
      renderPage(Page);
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      expect(screen.getByText(NOTICE)).toBeTruthy();
      expect(screen.queryAllByRole('button')).toEqual([]);
    },
  );

  it.each(RADIO_PAGES)('%s keeps its controls in a browser', (title, Page) => {
    renderPage(Page);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
