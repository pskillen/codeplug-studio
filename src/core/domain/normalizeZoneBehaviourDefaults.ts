import type { ZoneBehaviourDefaults } from '@core/models/zoneBehaviourDefaults.ts';
import { DEFAULT_ZONE_BEHAVIOUR_DEFAULTS } from '@core/models/zoneBehaviourDefaults.ts';

/** Normalise persisted or imported library zone defaults. */
export function normalizeZoneBehaviourDefaults(
  defaults?: Partial<ZoneBehaviourDefaults> | null,
): ZoneBehaviourDefaults {
  if (!defaults) return { ...DEFAULT_ZONE_BEHAVIOUR_DEFAULTS };
  return {
    includeInZoneDerivedScanList:
      defaults.includeInZoneDerivedScanList ??
      DEFAULT_ZONE_BEHAVIOUR_DEFAULTS.includeInZoneDerivedScanList,
  };
}
