import { normalizeFormatBuildFields } from '@core/domain/migrateFormatBuild.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';

/** Normalise legacy or partial radio build rows read from storage. */
export function readRadioBuildRow(row: RadioBuild): RadioBuild {
  return normalizeFormatBuildFields(row);
}
