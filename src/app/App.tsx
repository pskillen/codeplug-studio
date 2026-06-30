import { HashRouter, Route, Routes } from 'react-router-dom';
import BuildFooter from './components/BuildFooter/BuildFooter.tsx';
import HomePage from './routes/HomePage.tsx';

export default function App() {
  return (
    <HashRouter>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ flex: 1, padding: '2rem' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
        <BuildFooter />
      </div>
    </HashRouter>
  );
}
