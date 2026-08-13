/**
 * Core domain types for the HF/RF Propagation Visualiser.
 *
 * Growing scaffold for the visualiser. `IonosphericLayerState` field names (`peakElectronDensity`,
 * `altitudeMinKm`, `altitudeMaxKm`) are load-bearing for the ray-trace stepper (#1168) — do not
 * rename them. `AntennaConfig.family`'s string-literal values are load-bearing for #1166. Later
 * phases add `RayTraceParams`, `RayPathResult`, and `PropagationMode` alongside these types.
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
