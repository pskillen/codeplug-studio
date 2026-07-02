import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import AppLayout from './components/AppLayout/AppLayout.tsx';
import RequireActiveProject from './components/RequireActiveProject/RequireActiveProject.tsx';
import HomePage from './routes/HomePage.tsx';
import EntityEditorPage from './routes/library/EntityEditorPage.tsx';
import AddFromUkRepeaterPage from './routes/library/AddFromUkRepeaterPage.tsx';
import AddFromBrandmeisterPage from './routes/library/AddFromBrandmeisterPage.tsx';
import ChannelsListPage from './routes/library/lists/ChannelsListPage.tsx';
import ZonesListPage from './routes/library/lists/ZonesListPage.tsx';
import TalkGroupsListPage from './routes/library/lists/TalkGroupsListPage.tsx';
import ContactsListPage from './routes/library/lists/ContactsListPage.tsx';
import RxGroupListsListPage from './routes/library/lists/RxGroupListsListPage.tsx';
import SummaryPage from './routes/SummaryPage.tsx';
import BandsReferencePage from './routes/reference/BandsReferencePage.tsx';
import MaidenheadReferencePage from './routes/reference/MaidenheadReferencePage.tsx';
import ReferenceIndexPage from './routes/reference/ReferenceIndexPage.tsx';
import SettingsPage from './routes/SettingsPage.tsx';
import HelpPage from './routes/HelpPage.tsx';
import StyleguidePage from './routes/StyleguidePage.tsx';
import DebugIndexPage from './routes/debug/DebugIndexPage.tsx';
import DebugIndexedDbPage from './routes/debug/DebugIndexedDbPage.tsx';
import DebugIndexedDbStorePage from './routes/debug/DebugIndexedDbStorePage.tsx';
import DebugIndexedDbRowViewerPage from './routes/debug/DebugIndexedDbRowViewerPage.tsx';
import DebugLocalStoragePage from './routes/debug/DebugLocalStoragePage.tsx';
import DebugLocalStorageViewerPage from './routes/debug/DebugLocalStorageViewerPage.tsx';
import ImportExportPage from './routes/import-export/ImportExportPage.tsx';
import BuildsListPage from './routes/builds/BuildsListPage.tsx';
import NewBuildPage from './routes/builds/NewBuildPage.tsx';
import BuildLayout from './routes/builds/BuildLayout.tsx';
import BuildOverviewPage from './routes/builds/BuildOverviewPage.tsx';
import BuildExportPage from './routes/builds/BuildExportPage.tsx';
import BuildChannelsWirePage from './routes/builds/wire-preview/BuildChannelsWirePage.tsx';
import BuildZonesWirePage from './routes/builds/wire-preview/BuildZonesWirePage.tsx';
import BuildTalkGroupsWirePage from './routes/builds/wire-preview/BuildTalkGroupsWirePage.tsx';
import BuildContactsWirePage from './routes/builds/wire-preview/BuildContactsWirePage.tsx';
import BuildRxGroupListsWirePage from './routes/builds/wire-preview/BuildRxGroupListsWirePage.tsx';

function MapRedirect() {
  return <Navigate to="/library/channels" replace />;
}

export const appRouter = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/help', element: <HelpPage /> },
      { path: '/reference', element: <ReferenceIndexPage /> },
      { path: '/reference/maidenhead', element: <MaidenheadReferencePage /> },
      { path: '/reference/bands', element: <BandsReferencePage /> },
      { path: '/styleguide', element: <StyleguidePage /> },
      { path: '/debug', element: <DebugIndexPage /> },
      { path: '/debug/indexed-db', element: <DebugIndexedDbPage /> },
      { path: '/debug/indexed-db/:storeName', element: <DebugIndexedDbStorePage /> },
      {
        path: '/debug/indexed-db/:storeName/:projectId/:id',
        element: <DebugIndexedDbRowViewerPage />,
      },
      { path: '/debug/local-storage', element: <DebugLocalStoragePage /> },
      {
        path: '/debug/local-storage/:storageKey',
        element: <DebugLocalStorageViewerPage />,
      },
      {
        element: <RequireActiveProject />,
        children: [
          { path: '/library', element: <Navigate to="/library/channels" replace /> },
          { path: '/library/channels', element: <ChannelsListPage /> },
          { path: '/library/zones', element: <ZonesListPage /> },
          { path: '/library/talk-groups', element: <TalkGroupsListPage /> },
          { path: '/library/contacts', element: <ContactsListPage /> },
          { path: '/library/rx-group-lists', element: <RxGroupListsListPage /> },
          {
            path: '/library/channels/add-from-ukrepeater',
            element: <AddFromUkRepeaterPage />,
          },
          {
            path: '/library/channels/add-from-brandmeister',
            element: <AddFromBrandmeisterPage />,
          },
          { path: '/library/:kind/:id', element: <EntityEditorPage /> },
          { path: '/builds', element: <BuildsListPage /> },
          { path: '/builds/new', element: <NewBuildPage /> },
          {
            path: '/builds/:id',
            element: <BuildLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: 'overview', element: <BuildOverviewPage /> },
              { path: 'channels', element: <BuildChannelsWirePage /> },
              { path: 'zones', element: <BuildZonesWirePage /> },
              { path: 'talk-groups', element: <BuildTalkGroupsWirePage /> },
              { path: 'contacts', element: <BuildContactsWirePage /> },
              { path: 'rx-group-lists', element: <BuildRxGroupListsWirePage /> },
              { path: 'export', element: <BuildExportPage /> },
            ],
          },
          { path: '/import-export', element: <ImportExportPage /> },
          { path: '/summary', element: <SummaryPage /> },
          { path: '/reports', element: <Navigate to="/summary" replace /> },
          { path: '/map', element: <MapRedirect /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={appRouter} />;
}
