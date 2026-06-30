import { useContext } from 'react';
import { ProjectContext, type ProjectContextValue } from './ProjectContext.ts';

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return ctx;
}
