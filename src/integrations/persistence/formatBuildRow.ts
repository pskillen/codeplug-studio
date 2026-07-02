import { normalizeFormatBuildFields } from '@core/domain/migrateFormatBuild.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';

/** Normalise legacy or partial format build rows read from storage. */
export function readFormatBuildRow(row: FormatBuild): FormatBuild {
  return normalizeFormatBuildFields(row);
}
