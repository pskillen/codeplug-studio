import type { PersistableRow } from './revision.ts';
import type { ProjectInterchange } from './interchange.ts';

export interface ProjectMeta extends PersistableRow {
  name: string;
  description: string;
  notes: string;
  author: string;
  createdAt: string;
  interchange?: ProjectInterchange;
}
