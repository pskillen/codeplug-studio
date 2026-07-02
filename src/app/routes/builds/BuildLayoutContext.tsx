import { createContext, useContext, type ReactNode } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';

export interface BuildLayoutContextValue {
  build: FormatBuild;
  buildId: string;
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
