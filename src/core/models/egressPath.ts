import type { CpsWireHydration } from './cpsWireHydration.ts';
import type { PersistableRow } from './revision.ts';

/** How this pathway delivers assembled data toward the radio. */
export type EgressKind = 'cps-file' | 'web-serial';

/**
 * Persisted egress pathway under a {@link RadioBuild}.
 * Holds adapter identity (`formatId` / `profileId`) and operation hydration
 * (NeonPlug donor, radio-clone image) — not wire names or trait layout (#654).
 */
export interface EgressPath extends PersistableRow {
  /** Parent {@link RadioBuild.id}. */
  radioBuildId: string;
  /** Catalog format id (`neonplug`, `chirp`, `radio-io`, …). */
  formatId: string;
  /** Catalog profile id (`neonplug-uv5rmini`, `chirp-uv5r`, `radio-io-uv5r-mini`, …). */
  profileId: string;
  kind: EgressKind;
  /** Optional display label (defaults to profile/format label in UI). */
  label?: string;
  /**
   * Operation hydration for this pathway only (NeonPlug donor / radio-clone image).
   * Not library wire-stash; labelled escape hatch for unmodelled retain.
   */
  hydration?: CpsWireHydration;
}

export function egressKindForFormatId(formatId: string): EgressKind {
  return formatId === 'radio-io' ? 'web-serial' : 'cps-file';
}
