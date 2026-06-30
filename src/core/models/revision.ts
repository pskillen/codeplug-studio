/** Shared persistable row metadata — optimistic concurrency in integrations layer. */
export interface PersistableRow {
  id: string;
  projectId: string;
  revision: number;
  updatedAt: string;
}

export function initialRevision(): number {
  return 1;
}

export function nextRevision(current: number): number {
  return current + 1;
}

export function isoNow(): string {
  return new Date().toISOString();
}
