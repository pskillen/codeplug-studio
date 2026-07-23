import { createContext, useContext, type ReactNode } from 'react';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';

export interface BuildLayoutContextValue {
  build: RadioBuild;
  buildId: string;
  egressPaths: EgressPath[];
  activeEgress: EgressPath | null;
  setActiveEgressId: (id: string) => void;
  reloadEgressPaths: () => Promise<void>;
}

const BuildLayoutContext = createContext<BuildLayoutContextValue | null>(null);

export function BuildLayoutProvider({
  value,
  children,
}: {
  value: BuildLayoutContextValue;
  children: ReactNode;
}) {
  return <BuildLayoutContext.Provider value={value}>{children}</BuildLayoutContext.Provider>;
}

export function useBuildLayout(): BuildLayoutContextValue {
  const value = useContext(BuildLayoutContext);
  if (!value) {
    throw new Error('useBuildLayout must be used within BuildLayout');
  }
  return value;
}

/** Section nav renders outside {@link BuildLayoutProvider}; use when egress may be absent. */
export function useOptionalBuildLayout(): BuildLayoutContextValue | null {
  return useContext(BuildLayoutContext);
}
