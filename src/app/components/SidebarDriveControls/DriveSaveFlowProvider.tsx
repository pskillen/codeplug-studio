import { createContext, useContext, type ReactNode } from 'react';
import { useDriveSaveFlow, type UseDriveSaveFlowOptions } from '../../hooks/useDriveSaveFlow.ts';

export type DriveSaveFlowContextValue = ReturnType<typeof useDriveSaveFlow>;

const DriveSaveFlowContext = createContext<DriveSaveFlowContextValue | null>(null);

export function useDriveSaveFlowContext(): DriveSaveFlowContextValue {
  const ctx = useContext(DriveSaveFlowContext);
  if (!ctx) {
    throw new Error('useDriveSaveFlowContext must be used within DriveSaveFlowProvider');
  }
  return ctx;
}

export interface DriveSaveFlowProviderProps extends UseDriveSaveFlowOptions {
  children: ReactNode;
}

/** Shared Drive save/conflict flow for shell controls and project chip status. */
export default function DriveSaveFlowProvider({
  children,
  ...options
}: DriveSaveFlowProviderProps) {
  const flow = useDriveSaveFlow(options);
  return <DriveSaveFlowContext.Provider value={flow}>{children}</DriveSaveFlowContext.Provider>;
}
