import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout/AppLayout.tsx';
import RequireActiveProject from './components/RequireActiveProject/RequireActiveProject.tsx';
import HomePage from './routes/HomePage.tsx';
import LibraryPage from './routes/LibraryPage.tsx';
import EntityEditorPage from './routes/library/EntityEditorPage.tsx';
import AddFromUkRepeaterPage from './routes/library/AddFromUkRepeaterPage.tsx';
import AddFromBrandmeisterPage from './routes/library/AddFromBrandmeisterPage.tsx';
import MapPage from './routes/MapPage.tsx';
import SummaryPage from './routes/SummaryPage.tsx';
import ReferencePage from './routes/ReferencePage.tsx';
import SettingsPage from './routes/SettingsPage.tsx';
import HelpPage from './routes/HelpPage.tsx';
import StyleguidePage from './routes/StyleguidePage.tsx';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/styleguide" element={<StyleguidePage />} />
          <Route element={<RequireActiveProject />}>
            <Route path="/library" element={<LibraryPage />} />
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
            <Route path="/map" element={<MapPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
