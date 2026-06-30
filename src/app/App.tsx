import { HashRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout/AppLayout.tsx';
import RequireActiveProject from './components/RequireActiveProject/RequireActiveProject.tsx';
import HomePage from './routes/HomePage.tsx';
import LibraryPage from './routes/LibraryPage.tsx';
import EntityEditorPage from './routes/library/EntityEditorPage.tsx';
import MapPage from './routes/MapPage.tsx';
import RepeatersPage from './routes/RepeatersPage.tsx';
import ReportsPage from './routes/ReportsPage.tsx';
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
            <Route path="/library/:kind/:id" element={<EntityEditorPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/repeaters" element={<RepeatersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
