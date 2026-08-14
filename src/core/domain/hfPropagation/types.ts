/**
 * Core domain types for the HF/RF Propagation Visualiser.
 *
 * Growing scaffold for the visualiser. `IonosphericLayerState` field names (`peakElectronDensity`,
 * `altitudeMinKm`, `altitudeMaxKm`) are load-bearing for the ray-trace stepper (#1168) — do not
 * rename them. `AntennaConfig.family`'s string-literal values are load-bearing for #1166.
 * `RayPathResult.points` are 2D plane coordinates in this phase; phase 7 maps them onto the
 * sphere and adds `txLat`/`txLon`/`atMs` to `RayTraceParams`.
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
  /** 2D-plane coordinates in this phase — elevation-plane distance (m) and altitude (km), NOT
   * yet lat/lon. Phase 7 maps these onto the sphere and replaces this with { lat, lon, altitudeKm }. */
  planeDistanceM: number;
  altitudeKm: number;
}

export interface RayPathResult {
  mode: PropagationMode;
  points: RayPathPoint[];
  takeoffAngleDeg: number;
  /** Placeholder in this phase — always 1.0 (0 for escaped). Phase 7 replaces with real D-layer attenuation. */
  relativeSignalStrength: number;
}

export interface RayTraceParams {
  frequencyMhz: number;
  antenna: AntennaConfig;
  layers: IonosphericLayerState[];
  azimuthDeg: number;
}
