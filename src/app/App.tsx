import { HashRouter, Route, Routes } from 'react-router-dom';
import ProjectProvider from './state/ProjectProvider.tsx';
import AppLayout from './components/AppLayout/AppLayout.tsx';
import HomePage from './routes/HomePage.tsx';
import LibraryPage from './routes/LibraryPage.tsx';
import MapPage from './routes/MapPage.tsx';
import ReportsPage from './routes/ReportsPage.tsx';
import SettingsPage from './routes/SettingsPage.tsx';
import HelpPage from './routes/HelpPage.tsx';

export default function App() {
  return (
    <ProjectProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<HelpPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ProjectProvider>
  );
}
