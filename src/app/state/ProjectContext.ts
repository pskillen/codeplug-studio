import { createContext } from 'react';
import type { ProjectMeta } from '@core/models/project.ts';

export interface ProjectContextValue {
  projects: ProjectMeta[];
  activeProjectId: string | null;
  activeProject: ProjectMeta | null;
  loading: boolean;
  /** Creates the project, makes it active and resolves to its id. */
  createProject: (name: string) => Promise<string>;
  switchProject: (projectId: string) => void;
  renameProject: (projectId: string, name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);
