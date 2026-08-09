import type { PersistableRow } from './revision.ts';
import type { GeoPoint } from './libraryTypes.ts';

/** How the observer's coordinates were last set. */
export type ObserverPositionSource = 'geolocation' | 'maidenhead' | 'address' | 'map';

/**
 * Per-project observer location for satellite pass prediction. Singleton
 * (at most one per project) — a tracking-dashboard preference, not vendor-neutral
 * library RF content, so it is not part of `Library`/`LibraryEntityKind`.
 */
export interface TrackingSettings extends PersistableRow {
  positionSource: ObserverPositionSource;
  location: GeoPoint | null;
  maidenheadLocator: string | null;
}
