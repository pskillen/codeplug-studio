/**
 * Core domain types for the HF/RF Propagation Visualiser.
 *
 * Growing scaffold for the visualiser. `IonosphericLayerState` field names (`peakElectronDensity`,
 * `altitudeMinKm`, `altitudeMaxKm`) are load-bearing for the ray-trace stepper (#1168) — do not
 * rename them. `AntennaConfig.family`'s string-literal values are load-bearing for #1166.
 * `RayPathResult.points` are sphere-mapped `{ lat, lon, altitudeKm }` triples. `RayTraceParams`
 * includes `txLat`/`txLon`/`atMs` for the Worker contract (`atMs` is unused by the domain math
 * in this module).
 */

export type AntennaPatternFamily =
  | 'omnidirectional-vertical'
  | 'bidirectional-transverse'
  | 'directional-lobe'
  | 'multi-lobe-conical';

export interface AntennaConfig {
  family: AntennaPatternFamily;
  heightM: number;
  azimuthDeg?: number;
  wireLengthWavelengths?: number;
}

export type SolarActivityPreset = 'quiet' | 'moderate' | 'solar-max' | 'storm';

export type IonosphericLayerId = 'D' | 'E' | 'F1' | 'F2';

export interface IonosphericLayerState {
  id: IonosphericLayerId;
  active: boolean;
  altitudeMinKm: number;
  altitudeMaxKm: number;
  peakElectronDensity: number; // Ne,max, electrons/m^3
}

export type PropagationMode = 'groundwave' | 'skywave' | 'nvis' | 'escaped' | 'absorbed';

export interface RayPathPoint {
  lat: number;
  lon: number;
  altitudeKm: number;
}

export interface RayPathResult {
  mode: PropagationMode;
  points: RayPathPoint[];
  takeoffAngleDeg: number;
  /** 1.0 reflected with no D-layer absorption; 0 escaped; otherwise D-layer attenuation in [0, 1]. */
  relativeSignalStrength: number;
}

export interface RayTraceParams {
  frequencyMhz: number;
  antenna: AntennaConfig;
  layers: IonosphericLayerState[];
  azimuthDeg: number;
  txLat: number;
  txLon: number;
  /** Instant for the Worker contract. Unused by domain ray-trace math (ionospheric layers are supplied already). */
  atMs: number;
}
