import type { GeoPoint } from '@core/models/libraryTypes.ts';

/** A Meshtastic router/repeater node, normalised from the Meshflow wire shape. */
export interface MeshtasticInfrastructureNode {
  /** Node id string, e.g. "!02d8b5b0". */
  nodeId: string;
  /** Trimmed; '' when absent. */
  longName: string;
  /** Trimmed; '' when absent. */
  shortName: string;
  /** Humanised role ("ROUTER_LATE" becomes "Router late"); '' when absent. */
  role: string;
  /** Trimmed; '' when absent. Kept for the reference doc; not shown. */
  hardwareModel: string;
  /** ISO string as received; null when absent or unparseable. */
  lastHeardAt: string | null;
  location: GeoPoint;
  altitudeM: number | null;
}

export interface MeshtasticNearbyQuery {
  lat: number;
  lon: number;
  radiusKm: number;
}

export interface MeshtasticNearbyResult {
  nodes: MeshtasticInfrastructureNode[];
  /** True when Meshflow capped the result list. */
  truncated: boolean;
  requestedRadiusKm: number;
}
