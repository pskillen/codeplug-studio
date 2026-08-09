/**
 * Decoded TLE fields prior to library merge (no `id`/`enabled`/`source` —
 * assigned by the integrations-layer merge step against existing rows).
 */
export interface ParsedTleEntry {
  name: string;
  noradId: number;
  tleLine1: string;
  tleLine2: string;
  epoch: string;
  classification: string;
  inclinationDeg: number;
  raanDeg: number;
  eccentricity: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
  bstar: number;
  elementSetNumber: number;
  revolutionNumber: number;
}

/** A malformed 3-line group skipped during parsing — collected, not thrown. */
export interface TleParseWarning {
  /** Index (in the filtered non-blank line array) the group started at. */
  index: number;
  message: string;
  raw: string;
}

export interface TleParseResult {
  entries: ParsedTleEntry[];
  warnings: TleParseWarning[];
}
