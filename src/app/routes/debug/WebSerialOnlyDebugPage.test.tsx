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
  ['AT-D890UV erase-unit probe', DebugD890EraseProbePage],
  ['Serial reopen timing', DebugSerialReopenPage],
  ['UV-5R Mini full read', DebugUv5rMiniPage],
];

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

  it.each(WEB_SERIAL_PAGES)('%s keeps its controls in a browser', (title, Page) => {
    renderPage(Page);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
