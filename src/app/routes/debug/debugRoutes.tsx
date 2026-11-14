import type { RouteObject } from 'react-router-dom';
import DebugGate from './DebugGate.tsx';
import DebugD890EraseProbePage from './DebugD890EraseProbePage.tsx';
import DebugIndexPage from './DebugIndexPage.tsx';
import DebugIndexedDbPage from './DebugIndexedDbPage.tsx';
import DebugIndexedDbRowViewerPage from './DebugIndexedDbRowViewerPage.tsx';
import DebugIndexedDbStorePage from './DebugIndexedDbStorePage.tsx';
import DebugLocalStoragePage from './DebugLocalStoragePage.tsx';
import DebugLocalStorageViewerPage from './DebugLocalStorageViewerPage.tsx';
import DebugSerialReopenPage from './DebugSerialReopenPage.tsx';
import DebugUv5rMiniPage from './DebugUv5rMiniPage.tsx';

/**
 * Every Debug page. Add a new debug page here: the app router mounts this list under {@link DebugGate}, so the page
 * is hidden on prod unless developer mode is on (#1650). `App.test.tsx` fails if a `/debug` route sits anywhere else.
 */
export const debugRoutes: RouteObject[] = [
  { path: '/debug', element: <DebugIndexPage /> },
  { path: '/debug/indexed-db', element: <DebugIndexedDbPage /> },
  { path: '/debug/indexed-db/:storeName', element: <DebugIndexedDbStorePage /> },
  {
    path: '/debug/indexed-db/:storeName/:projectId/:id',
    element: <DebugIndexedDbRowViewerPage />,
  },
  { path: '/debug/local-storage', element: <DebugLocalStoragePage /> },
  { path: '/debug/local-storage/:storageKey', element: <DebugLocalStorageViewerPage /> },
  { path: '/debug/d890-erase-probe', element: <DebugD890EraseProbePage /> },
  { path: '/debug/serial-reopen', element: <DebugSerialReopenPage /> },
  { path: '/debug/uv5r-mini', element: <DebugUv5rMiniPage /> },
];

/** The layout route the app router mounts: {@link DebugGate} over {@link debugRoutes}. */
export const gatedDebugRoute: RouteObject = { element: <DebugGate />, children: debugRoutes };
