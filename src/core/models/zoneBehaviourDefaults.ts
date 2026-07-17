/** Library-wide behavioural defaults for zones. */

/** Per-member override for zone-derived scan list membership — `default` defers to cascade. */
export type IncludeInZoneDerivedScanListOverride = 'default' | 'include' | 'skip';

/** Resolved include/skip after cascade. */
export type EffectiveIncludeInZoneDerivedScanList = 'include' | 'skip';

/** Per-exported-zone projection override (build layout). */
export type ZoneScanMemberProjection = 'include' | 'skip';

/** Library-wide behavioural defaults for zones. */
export interface ZoneBehaviourDefaults {
  /**
   * When true, zone members with `includeInScanList: default` participate in
   * zone-derived scan lists (formats that synthesise scan lists from zones).
   */
  includeInZoneDerivedScanList: boolean;
}

export const DEFAULT_ZONE_BEHAVIOUR_DEFAULTS: ZoneBehaviourDefaults = {
  includeInZoneDerivedScanList: true,
};
