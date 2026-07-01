import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import 'leaflet/dist/leaflet.css';
import '../index.css';
import App from './App.tsx';
import ProjectProvider from './state/ProjectProvider.tsx';
import { OperatorPositionProvider } from './state/operatorPosition.tsx';
import { theme } from './theme.ts';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <ColorSchemeScript defaultColorScheme="dark" />
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ProjectProvider>
        <OperatorPositionProvider>
          <App />
        </OperatorPositionProvider>
      </ProjectProvider>
    </MantineProvider>
  </StrictMode>,
);
