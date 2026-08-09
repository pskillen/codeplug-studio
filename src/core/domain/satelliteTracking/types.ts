/** Ground observer coordinates for pass prediction (degrees, WGS84). */
export interface ObserverLocation {
  latDeg: number;
  lonDeg: number;
  /** Elevation above the ellipsoid, km. Defaults to 0 (sea level) when omitted. */
  heightKm?: number;
}

export interface PassPredictionWindow {
  /** ISO 8601 window start. */
  fromAt: string;
  /** ISO 8601 window end. */
  toAt: string;
  /** Sweep granularity in minutes. Defaults to 1. */
  stepMinutes?: number;
}

export interface PassResult {
  aosAt: string;
  losAt: string;
  maxElevationAt: string;
  maxElevationDeg: number;
  durationSec: number;
}
