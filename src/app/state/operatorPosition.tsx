import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface OperatorPosition {
  lat: number;
  lon: number;
  accuracyMeters: number | null;
}

interface OperatorPositionContextValue {
  position: OperatorPosition | null;
  setPosition: (position: OperatorPosition) => void;
  clearPosition: () => void;
}

const OperatorPositionContext = createContext<OperatorPositionContextValue | null>(null);

export function OperatorPositionProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<OperatorPosition | null>(null);

  const setPosition = useCallback((next: OperatorPosition) => {
    setPositionState(next);
  }, []);

  const clearPosition = useCallback(() => {
    setPositionState(null);
  }, []);

  const value = useMemo(
    () => ({ position, setPosition, clearPosition }),
    [position, setPosition, clearPosition],
  );

  return (
    <OperatorPositionContext.Provider value={value}>{children}</OperatorPositionContext.Provider>
  );
}

export function useOperatorPosition(): OperatorPositionContextValue {
  const ctx = useContext(OperatorPositionContext);
  if (!ctx) {
    throw new Error('useOperatorPosition must be used within OperatorPositionProvider');
  }
  return ctx;
}
