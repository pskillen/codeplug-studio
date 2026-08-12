/** Local RadioID shadow row — not PersistableRow; not in ProjectSeed. */
export interface DigitalIdDirectoryEntry {
  projectId: string;
  digitalId: number;
  mode: 'dmr';
  name: string;
  callsign: string;
  city: string;
  state: string;
  country: string;
  remarks?: string;
  /** Optional stale UX; not Drive dirty. */
  fetchedAt?: string;
}
