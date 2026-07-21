import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AppLayout from './components/AppLayout/AppLayout.tsx';
import RequireActiveProject from './components/RequireActiveProject/RequireActiveProject.tsx';
import HomePage from './routes/HomePage.tsx';
import EntityEditorPage from './routes/library/EntityEditorPage.tsx';
import AddFromUkRepeaterPage from './routes/library/AddFromUkRepeaterPage.tsx';
import AddFromOpenAipPage from './routes/library/AddFromOpenAipPage.tsx';
import AddFromBrandmeisterPage from './routes/library/AddFromBrandmeisterPage.tsx';
import AddFromIrtsPage from './routes/library/AddFromIrtsPage.tsx';
import AddFromRepeaterBookPage from './routes/library/AddFromRepeaterBookPage.tsx';
import AddFromRadioidPage from './routes/library/AddFromRadioidPage.tsx';
import AddChannelSetPage from './routes/library/AddChannelSetPage.tsx';
import ZoneFromLocationPage from './routes/library/ZoneFromLocationPage.tsx';
import ChannelsListPage from './routes/library/lists/ChannelsListPage.tsx';
import ZonesListPage from './routes/library/lists/ZonesListPage.tsx';
import TalkGroupsListPage from './routes/library/lists/TalkGroupsListPage.tsx';
import ContactsListPage from './routes/library/lists/ContactsListPage.tsx';
import RxGroupListsListPage from './routes/library/lists/RxGroupListsListPage.tsx';
import ScanListsListPage from './routes/library/lists/ScanListsListPage.tsx';
import AprsConfigurationPage from './routes/library/AprsConfigurationPage.tsx';
import ChannelDefaultsPage from './routes/library/ChannelDefaultsPage.tsx';
import ZoneDefaultsPage from './routes/library/ZoneDefaultsPage.tsx';
import SummaryPage from './routes/SummaryPage.tsx';
import BandsReferencePage from './routes/reference/BandsReferencePage.tsx';
import MaidenheadReferencePage from './routes/reference/MaidenheadReferencePage.tsx';
import ReferenceIndexPage from './routes/reference/ReferenceIndexPage.tsx';
import SettingsPage from './routes/SettingsPage.tsx';
import HelpPage from './routes/HelpPage.tsx';
import StyleguideIndexPage from './routes/styleguide/StyleguideIndexPage.tsx';
import StyleguideLayoutPage from './routes/styleguide/StyleguideLayoutPage.tsx';
import StyleguideDataTablePage from './routes/styleguide/StyleguideDataTablePage.tsx';
import StyleguideMembershipPage from './routes/styleguide/StyleguideMembershipPage.tsx';
import StyleguideControlsPage from './routes/styleguide/StyleguideControlsPage.tsx';
import DebugIndexPage from './routes/debug/DebugIndexPage.tsx';
import DebugIndexedDbPage from './routes/debug/DebugIndexedDbPage.tsx';
import DebugIndexedDbStorePage from './routes/debug/DebugIndexedDbStorePage.tsx';
import DebugIndexedDbRowViewerPage from './routes/debug/DebugIndexedDbRowViewerPage.tsx';
import DebugLocalStoragePage from './routes/debug/DebugLocalStoragePage.tsx';
import DebugLocalStorageViewerPage from './routes/debug/DebugLocalStorageViewerPage.tsx';
import BuildsListPage from './routes/builds/BuildsListPage.tsx';
import NewBuildPage from './routes/builds/NewBuildPage.tsx';
import BuildLayout from './routes/builds/BuildLayout.tsx';
import BuildOverviewPage from './routes/builds/BuildOverviewPage.tsx';
import BuildCharacteristicsPage from './routes/builds/BuildCharacteristicsPage.tsx';
import BuildNeonplugSettingsPage from './routes/builds/BuildNeonplugSettingsPage.tsx';
import BuildFlatMemoryScanListPage from './routes/builds/BuildFlatMemoryScanListPage.tsx';
import BuildExportPage from './routes/builds/BuildExportPage.tsx';
import BuildExportResolutionPage from './routes/builds/BuildExportResolutionPage.tsx';
import BuildChannelsWirePage from './routes/builds/wire-preview/BuildChannelsWirePage.tsx';
import BuildChannelsBulkEditPage from './routes/builds/wire-preview/BuildChannelsBulkEditPage.tsx';
import BuildZonesWirePage from './routes/builds/wire-preview/BuildZonesWirePage.tsx';
import BuildScanListsWirePage from './routes/builds/wire-preview/BuildScanListsWirePage.tsx';
import BuildTalkGroupsWirePage from './routes/builds/wire-preview/BuildTalkGroupsWirePage.tsx';
import BuildContactsWirePage from './routes/builds/wire-preview/BuildContactsWirePage.tsx';
import BuildRxGroupListsWirePage from './routes/builds/wire-preview/BuildRxGroupListsWirePage.tsx';
import BuildAirbandWirePage from './routes/builds/wire-preview/BuildAirbandWirePage.tsx';
import PrivacyPolicyPage from './routes/legal/PrivacyPolicyPage.tsx';
import TermsOfUsePage from './routes/legal/TermsOfUsePage.tsx';
import CookiesPage from './routes/legal/CookiesPage.tsx';
import AttributionsPage from './routes/AttributionsPage.tsx';

function MapRedirect() {
  return <Navigate to="/library/channels" replace />;
}

export const appRouter = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/help', element: <HelpPage /> },
      { path: '/attributions', element: <AttributionsPage /> },
      { path: '/privacy', element: <PrivacyPolicyPage /> },
      { path: '/terms', element: <TermsOfUsePage /> },
      { path: '/cookies', element: <CookiesPage /> },
      { path: '/reference', element: <ReferenceIndexPage /> },
      { path: '/reference/maidenhead', element: <MaidenheadReferencePage /> },
      { path: '/reference/bands', element: <BandsReferencePage /> },
      { path: '/styleguide', element: <StyleguideIndexPage /> },
      { path: '/styleguide/layout', element: <StyleguideLayoutPage /> },
      { path: '/styleguide/data-table', element: <StyleguideDataTablePage /> },
      { path: '/styleguide/membership', element: <StyleguideMembershipPage /> },
      { path: '/styleguide/controls', element: <StyleguideControlsPage /> },
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
          { path: '/library/channels/defaults', element: <ChannelDefaultsPage /> },
          { path: '/library/zones/defaults', element: <ZoneDefaultsPage /> },
          { path: '/library/zones', element: <ZonesListPage /> },
          {
            path: '/library/zones/new-from-location',
            element: <ZoneFromLocationPage />,
          },
          { path: '/library/talk-groups', element: <TalkGroupsListPage /> },
          { path: '/library/contacts', element: <ContactsListPage /> },
          {
            path: '/library/contacts/add-from-radioid',
            element: <AddFromRadioidPage />,
          },
          { path: '/library/rx-group-lists', element: <RxGroupListsListPage /> },
          { path: '/library/scan-lists', element: <ScanListsListPage /> },
          { path: '/library/aprs-configuration', element: <AprsConfigurationPage /> },
          {
            path: '/library/aprs-configurations',
            element: <Navigate to="/library/aprs-configuration" replace />,
          },
          {
            path: '/library/aprs-configurations/*',
            element: <Navigate to="/library/aprs-configuration" replace />,
          },
          {
            path: '/library/channels/add-from-ukrepeater',
            element: <AddFromUkRepeaterPage />,
          },
          {
            path: '/library/channels/add-from-openaip',
            element: <AddFromOpenAipPage />,
          },
          {
            path: '/library/channels/add-from-brandmeister',
            element: <AddFromBrandmeisterPage />,
          },
          {
            path: '/library/channels/add-from-irts',
            element: <AddFromIrtsPage />,
          },
          {
            path: '/library/channels/add-from-repeaterbook',
            element: <AddFromRepeaterBookPage />,
          },
          {
            path: '/library/channels/add-channel-set',
            element: <AddChannelSetPage />,
          },
          { path: '/library/:kind/:id', element: <EntityEditorPage /> },
          { path: '/builds', element: <BuildsListPage /> },
          { path: '/builds/new', element: <NewBuildPage /> },
          {
            path: '/builds/:id',
            element: <BuildLayout />,
            children: [
              { index: true, element: <Navigate to="export" replace /> },
              { path: 'overview', element: <BuildOverviewPage /> },
              { path: 'characteristics', element: <BuildCharacteristicsPage /> },
              { path: 'memories', element: <Navigate to="channels" replace /> },
              { path: 'channels/bulk', element: <BuildChannelsBulkEditPage /> },
              { path: 'channels', element: <BuildChannelsWirePage /> },
              { path: 'scan-list', element: <BuildFlatMemoryScanListPage /> },
              { path: 'airband', element: <BuildAirbandWirePage /> },
              { path: 'zones', element: <BuildZonesWirePage /> },
              { path: 'scan-lists', element: <BuildScanListsWirePage /> },
              { path: 'talk-groups', element: <BuildTalkGroupsWirePage /> },
              { path: 'contacts', element: <BuildContactsWirePage /> },
              { path: 'rx-group-lists', element: <BuildRxGroupListsWirePage /> },
              { path: 'export', element: <BuildExportPage /> },
              { path: 'export-resolution', element: <BuildExportResolutionPage /> },
              { path: 'neonplug-settings', element: <BuildNeonplugSettingsPage /> },
            ],
          },
          { path: '/import-export', element: <Navigate to="/summary" replace /> },
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
