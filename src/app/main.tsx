import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import 'leaflet/dist/leaflet.css';
import '../index.css';
import { registerNativeAuthRedirectListener } from '../integrations/cloud/nativeAuthRedirect.ts';
import { isNativeApp } from '../integrations/platform/isNativeApp.ts';
import App from './App.tsx';
import ProjectProvider from './state/ProjectProvider.tsx';
import DriveSessionProvider from './state/DriveSessionProvider.tsx';
import { OperatorPositionProvider } from './state/operatorPosition.tsx';
import { SatelliteEnrichmentProvider } from './state/satelliteEnrichment.tsx';
import { theme } from './theme.ts';

if (isNativeApp()) {
  registerNativeAuthRedirectListener();
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <ColorSchemeScript defaultColorScheme="dark" />
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ProjectProvider>
        <DriveSessionProvider>
          <OperatorPositionProvider>
            <SatelliteEnrichmentProvider>
              <App />
            </SatelliteEnrichmentProvider>
          </OperatorPositionProvider>
        </DriveSessionProvider>
      </ProjectProvider>
    </MantineProvider>
  </StrictMode>,
);
