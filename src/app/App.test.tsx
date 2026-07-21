import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import {
  ACTIVE_PROJECT_KEY,
  ANALYTICS_CONSENT_KEY,
  MAPBOX_TOKEN_KEY,
  saveActiveProjectId,
  setAnalyticsConsent,
} from '@integrations/preferences/index.ts';
import App, { appRouter } from './App.tsx';
import ProjectProvider from './state/ProjectProvider.tsx';
import DriveSessionProvider from './state/DriveSessionProvider.tsx';
import { OperatorPositionProvider } from './state/operatorPosition.tsx';
import { persistence } from './state/persistence.ts';
import { theme } from './theme.ts';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  Polygon: () => null,
  Polyline: () => null,
  Circle: () => null,
  Tooltip: () => null,
  useMap: () => ({
    fitBounds: vi.fn(),
    setView: vi.fn(),
    invalidateSize: vi.fn(),
    getContainer: () => {
      const parent = document.createElement('div');
      const container = document.createElement('div');
      parent.appendChild(container);
      return container;
    },
  }),
  useMapEvents: () => null,
}));

vi.mock('@integrations/analytics/index.ts', () => ({
  trackPageView: vi.fn(),
  getMeasurementId: vi.fn(() => ''),
  initAnalytics: vi.fn(),
  resetAnalyticsForTests: vi.fn(),
  isAnalyticsReady: vi.fn(() => false),
  subscribeAnalyticsReady: vi.fn(() => () => {}),
}));

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

function renderApp(initialRoute = '/') {
  const path = initialRoute.startsWith('#') ? initialRoute.slice(1) : initialRoute;
  window.history.pushState({}, '', path);
  if (appRouter.state.location.pathname !== path) {
    void appRouter.navigate(path, { replace: true });
  }
  return render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ProjectProvider>
        <DriveSessionProvider>
          <OperatorPositionProvider>
            <App />
          </OperatorPositionProvider>
        </DriveSessionProvider>
      </ProjectProvider>
    </MantineProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    void appRouter.navigate('/', { replace: true });
    vi.unstubAllGlobals();
  });

  it('shows debug nav without an active project', () => {
    renderApp('/');

    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reference' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Debug' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Library' })).not.toBeInTheDocument();
  });

  it('renders the debug index without an active project', async () => {
    renderApp('/debug');

    expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument();
    expect(screen.getByText(/Browser-local data/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'IndexedDB' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'LocalStorage' }).length).toBeGreaterThan(0);
  });

  it('lists localStorage keys on the debug localStorage page', () => {
    renderApp('/debug/local-storage');

    expect(screen.getByRole('heading', { name: 'LocalStorage' })).toBeInTheDocument();
    expect(screen.getByText(ACTIVE_PROJECT_KEY)).toBeInTheDocument();
    expect(screen.getByText(MAPBOX_TOKEN_KEY)).toBeInTheDocument();
  });

  it('renders the indexed-db overview page', async () => {
    renderApp('/debug/indexed-db');

    expect(screen.getByRole('heading', { name: 'IndexedDB' })).toBeInTheDocument();
    expect(await screen.findByText('channels')).toBeInTheDocument();
  });

  it('redirects /import-export to Summary with project interchange', async () => {
    const meta = newProjectMeta('Test project');
    await persistence.seedProject({ meta });
    saveActiveProjectId(meta.projectId);

    renderApp('/import-export');

    expect(await screen.findByRole('heading', { name: 'Project interchange' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download YAML/i })).toBeInTheDocument();
  });

  it('renders legal pages', () => {
    const privacy = renderApp('/privacy');
    expect(screen.getByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument();
    privacy.unmount();

    const terms = renderApp('/terms');
    expect(screen.getByRole('heading', { name: 'Terms of use' })).toBeInTheDocument();
    terms.unmount();

    renderApp('/cookies');
    expect(screen.getByRole('heading', { name: 'Cookies & storage' })).toBeInTheDocument();
  });

  it('shows cookie banner when consent is unset and hides after accept', () => {
    renderApp('/');

    const banner = screen.getByRole('dialog', { name: 'Cookie consent' });
    expect(banner).toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: 'Accept analytics' }));
    expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).not.toBeInTheDocument();
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toContain('accepted');
  });

  it('hides cookie banner when consent was previously declined', () => {
    setAnalyticsConsent('declined');
    renderApp('/');
    expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).not.toBeInTheDocument();
  });

  it('shows legal links in the footer', () => {
    setAnalyticsConsent('declined');
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Cookies' })).toHaveAttribute('href', '/cookies');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });
});
