import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import {
  ACTIVE_PROJECT_KEY,
  ANALYTICS_CONSENT_KEY,
  MAPBOX_TOKEN_KEY,
  saveActiveProjectId,
  setAnalyticsConsent,
} from '@integrations/preferences/index.ts';
import { DEVELOPER_MODE_KEY } from '@integrations/preferences/developerMode.ts';
import type { RouteObject } from 'react-router-dom';
import App, { appRouter } from './App.tsx';
import DebugGate from './routes/debug/DebugGate.tsx';
import ProjectProvider from './state/ProjectProvider.tsx';
import DriveSessionProvider from './state/DriveSessionProvider.tsx';
import { OperatorPositionProvider } from './state/operatorPosition.tsx';
import { persistence } from './state/persistence.ts';
import { theme } from './theme.ts';

// The build env the prod gate sees; tests flip it to 'prod' (the real `__BUILD_ENV__` is 'local' under vitest).
const gateEnv = vi.hoisted(() => ({ buildEnv: 'local' }));
vi.mock('./services/prodFeatureGate.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/prodFeatureGate.ts')>();
  return {
    ...actual,
    resolveDebugPagesGate: (options: { developerMode?: boolean } = {}) =>
      actual.resolveDebugPagesGate({ ...options, buildEnv: gateEnv.buildEnv }),
  };
});

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
    gateEnv.buildEnv = 'local';
    window.history.pushState({}, '', '/');
    void appRouter.navigate('/', { replace: true });
    vi.unstubAllGlobals();
  });

  it('shows tools and help without an active project; settings/debug in overflow', async () => {
    renderApp('/');

    expect(screen.getByRole('button', { name: 'No project open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Library' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const menuItems = await screen.findAllByRole('menuitem');
    expect(menuItems.map((el) => el.textContent)).toEqual(
      expect.arrayContaining(['Settings', 'Debug']),
    );
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
    expect(screen.getByRole('heading', { name: 'Android companion' })).toBeInTheDocument();
    expect(screen.getByText(/Programming a radio over USB does not upload/i)).toBeInTheDocument();
    expect(screen.getByText(/unless you start it/i)).toBeInTheDocument();
    privacy.unmount();

    const terms = renderApp('/terms');
    expect(screen.getByRole('heading', { name: 'Terms of use' })).toBeInTheDocument();
    expect(screen.getByText(/Play Store/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Direct radio programming' })).toBeInTheDocument();
    terms.unmount();

    renderApp('/cookies');
    expect(screen.getByRole('heading', { name: 'Cookies & storage' })).toBeInTheDocument();
    expect(screen.getByText(/Android companion app/i)).toBeInTheDocument();
  });

  it('shows cookie banner when consent is unset and hides after accept', () => {
    renderApp('/');

    const banner = screen.getByRole('dialog', { name: 'Cookie consent' });
    expect(banner).toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: 'Accept' }));
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

  describe('developer mode (#1650)', () => {
    /** Joins a child route's path onto its parent's, as the router resolves it. */
    function joinRoutePath(parent: string, path: string | undefined): string {
      if (path === undefined) return parent;
      if (path.startsWith('/')) return path;
      return `${parent.replace(/\/+$/, '')}/${path}`;
    }

    function debugPathsOutsideGate(
      routes: RouteObject[],
      underGate: boolean,
      parentPath = '',
    ): string[] {
      return routes.flatMap((route) => {
        const gated =
          underGate ||
          (typeof route.element === 'object' &&
            route.element !== null &&
            'type' in route.element &&
            route.element.type === DebugGate);
        const fullPath = joinRoutePath(parentPath, route.path);
        const isDebug = fullPath === '/debug' || fullPath.startsWith('/debug/');
        const own = route.path !== undefined && isDebug && !gated ? [fullPath] : [];
        return [...own, ...debugPathsOutsideGate(route.children ?? [], gated, fullPath)];
      });
    }

    async function overflowMenuLabels(): Promise<(string | null)[]> {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      const items = await screen.findAllByRole('menuitem');
      return items.map((el) => el.textContent);
    }

    it('mounts every /debug route under the debug gate', () => {
      expect(debugPathsOutsideGate(appRouter.routes as RouteObject[], false)).toEqual([]);
    });

    it('catches a relative debug child mounted outside the gate', () => {
      const routes: RouteObject[] = [
        { path: '/', children: [{ path: 'debug/x' }] },
        { children: [{ path: 'debug' }] },
      ];
      expect(debugPathsOutsideGate(routes, false)).toEqual(['/debug/x', '/debug']);
    });

    it('hides Debug on prod with developer mode off', async () => {
      gateEnv.buildEnv = 'prod';
      setAnalyticsConsent('declined');
      renderApp('/debug');
      await waitFor(() => expect(appRouter.state.location.pathname).toBe('/'));
      expect(screen.queryByRole('heading', { name: 'Debug' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('developer-mode-badge')).not.toBeInTheDocument();
      expect(await overflowMenuLabels()).not.toContain('Debug');
    });

    it('hides the UV-5R Mini debug page on prod with developer mode off', async () => {
      gateEnv.buildEnv = 'prod';
      setAnalyticsConsent('declined');
      renderApp('/debug/uv5r-mini');
      await waitFor(() => expect(appRouter.state.location.pathname).toBe('/'));
      expect(
        screen.queryByRole('heading', { name: 'UV-5R Mini full read' }),
      ).not.toBeInTheDocument();
    });

    it('shows the UV-5R Mini debug page on prod with developer mode on', async () => {
      gateEnv.buildEnv = 'prod';
      setAnalyticsConsent('declined');
      localStorage.setItem(DEVELOPER_MODE_KEY, 'on');
      renderApp('/debug/uv5r-mini');
      expect(
        await screen.findByRole('heading', { name: 'UV-5R Mini full read' }),
      ).toBeInTheDocument();
      expect(appRouter.state.location.pathname).toBe('/debug/uv5r-mini');
    });

    it('shows Debug and the badge on prod with developer mode on, and the badge turns it off', async () => {
      gateEnv.buildEnv = 'prod';
      setAnalyticsConsent('declined');
      localStorage.setItem(DEVELOPER_MODE_KEY, 'on');
      renderApp('/debug');
      expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument();
      expect(screen.getByTestId('developer-mode-badge')).toBeInTheDocument();
      expect(await overflowMenuLabels()).toContain('Debug');

      fireEvent.click(screen.getByRole('button', { name: 'Turn off developer mode' }));
      expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBeNull();
      expect(screen.queryByTestId('developer-mode-badge')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Debug' })).not.toBeInTheDocument();
    });

    it('shows no Debug entry on Tools on prod with developer mode off (#1673)', async () => {
      gateEnv.buildEnv = 'prod';
      setAnalyticsConsent('declined');
      renderApp('/reference');
      expect(await screen.findByRole('heading', { name: 'Tools' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Debug' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Debug overview' })).not.toBeInTheDocument();
    });

    it('shows the Debug entry on Tools on prod with developer mode on (#1673)', async () => {
      gateEnv.buildEnv = 'prod';
      setAnalyticsConsent('declined');
      localStorage.setItem(DEVELOPER_MODE_KEY, 'on');
      renderApp('/reference');
      expect(await screen.findByRole('heading', { name: 'Debug' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('link', { name: 'Debug overview' }));
      await waitFor(() => expect(appRouter.state.location.pathname).toBe('/debug'));
    });

    it('shows the Debug entry on Tools on pre-prod builds with developer mode off (#1673)', async () => {
      for (const env of ['local', 'main', 'dev', 'staging']) {
        gateEnv.buildEnv = env;
        setAnalyticsConsent('declined');
        const view = renderApp('/reference');
        expect(await screen.findByRole('heading', { name: 'Debug' })).toBeInTheDocument();
        view.unmount();
      }
    });

    it('shows Debug on pre-prod builds with developer mode off', async () => {
      for (const env of ['local', 'main', 'dev', 'staging']) {
        gateEnv.buildEnv = env;
        setAnalyticsConsent('declined');
        const view = renderApp('/debug');
        expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument();
        expect(await overflowMenuLabels()).toContain('Debug');
        view.unmount();
      }
    });

    it('turns on with five taps on the version in the footer', () => {
      gateEnv.buildEnv = 'prod';
      setAnalyticsConsent('declined');
      renderApp('/');
      const version = screen.getByTestId('build-version');
      for (let i = 0; i < 5; i += 1) fireEvent.click(version);
      expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBe('on');
      expect(screen.getByTestId('developer-mode-badge')).toBeInTheDocument();
    });
  });
});
