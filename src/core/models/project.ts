import type { PersistableRow } from './revision.ts';

export interface ProjectMeta extends PersistableRow {
  name: string;
  description: string;
  notes: string;
  author: string;
  createdAt: string;
}
