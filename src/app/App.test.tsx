import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import {
  ACTIVE_PROJECT_KEY,
  MAPBOX_TOKEN_KEY,
  saveActiveProjectId,
} from '@integrations/preferences/index.ts';
import App from './App.tsx';
import ProjectProvider from './state/ProjectProvider.tsx';
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
  window.location.hash = initialRoute.startsWith('#') ? initialRoute : `#${initialRoute}`;
  return render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ProjectProvider>
        <OperatorPositionProvider>
          <App />
        </OperatorPositionProvider>
      </ProjectProvider>
    </MantineProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
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

  it('renders import/export when a project is active', async () => {
    const meta = newProjectMeta('Test project');
    await persistence.seedProject({ meta });
    saveActiveProjectId(meta.projectId);

    renderApp('/import-export');

    expect(await screen.findByRole('heading', { name: 'Import / export' })).toBeInTheDocument();
    expect(screen.getByText(/vendor-neutral inside the project/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CPS formats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download YAML/i })).toBeInTheDocument();
  });
});
