import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
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

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/reference" element={<ReferenceIndexPage />} />
          <Route path="/reference/maidenhead" element={<MaidenheadReferencePage />} />
          <Route path="/reference/bands" element={<BandsReferencePage />} />
          <Route path="/styleguide" element={<StyleguidePage />} />
          <Route path="/debug" element={<DebugIndexPage />} />
          <Route path="/debug/indexed-db" element={<DebugIndexedDbPage />} />
          <Route path="/debug/indexed-db/:storeName" element={<DebugIndexedDbStorePage />} />
          <Route
            path="/debug/indexed-db/:storeName/:projectId/:id"
            element={<DebugIndexedDbRowViewerPage />}
          />
          <Route path="/debug/local-storage" element={<DebugLocalStoragePage />} />
          <Route
            path="/debug/local-storage/:storageKey"
            element={<DebugLocalStorageViewerPage />}
          />
          <Route element={<RequireActiveProject />}>
            <Route path="/library" element={<Navigate to="/library/channels" replace />} />
            <Route path="/library/channels" element={<ChannelsListPage />} />
            <Route path="/library/zones" element={<ZonesListPage />} />
            <Route path="/library/talk-groups" element={<TalkGroupsListPage />} />
            <Route path="/library/contacts" element={<ContactsListPage />} />
            <Route path="/library/rx-group-lists" element={<RxGroupListsListPage />} />
            <Route
              path="/library/channels/add-from-ukrepeater"
              element={<AddFromUkRepeaterPage />}
            />
            <Route
              path="/library/channels/add-from-brandmeister"
              element={<AddFromBrandmeisterPage />}
            />
            <Route path="/library/:kind/:id" element={<EntityEditorPage />} />
            <Route path="/builds" element={<BuildsListPage />} />
            <Route path="/builds/new" element={<NewBuildPage />} />
            <Route path="/builds/:id" element={<BuildLayout />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<BuildOverviewPage />} />
              <Route path="channels" element={<BuildChannelsWirePage />} />
              <Route path="zones" element={<BuildZonesWirePage />} />
              <Route path="talk-groups" element={<BuildTalkGroupsWirePage />} />
              <Route path="contacts" element={<BuildContactsWirePage />} />
              <Route path="rx-group-lists" element={<BuildRxGroupListsWirePage />} />
              <Route path="export" element={<BuildExportPage />} />
            </Route>
            <Route path="/import-export" element={<ImportExportPage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/reports" element={<Navigate to="/summary" replace />} />
            <Route path="/map" element={<MapRedirect />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
