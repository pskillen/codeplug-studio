import { createContext, useContext, type ReactNode } from 'react';
import { useRefreshFromDrivePrompt } from '../../hooks/useYamlImportResolver.ts';
import RefreshFromDriveBanner from './RefreshFromDriveBanner.tsx';

export type DriveRefreshContextValue = ReturnType<typeof useRefreshFromDrivePrompt>;

const DriveRefreshContext = createContext<DriveRefreshContextValue | null>(null);

export function useDriveRefresh(): DriveRefreshContextValue {
  const ctx = useContext(DriveRefreshContext);
  if (!ctx) {
    throw new Error('useDriveRefresh must be used within DriveRefreshProvider');
  }
  return ctx;
}

export interface DriveRefreshProviderProps {
  children: ReactNode;
}

export default function DriveRefreshProvider({ children }: DriveRefreshProviderProps) {
  const refresh = useRefreshFromDrivePrompt();

  return (
    <DriveRefreshContext.Provider value={refresh}>
      <RefreshFromDriveBanner />
      {children}
    </DriveRefreshContext.Provider>
  );
}
