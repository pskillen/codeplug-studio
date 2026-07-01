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
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/reports" element={<Navigate to="/summary" replace />} />
            <Route path="/map" element={<MapRedirect />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
