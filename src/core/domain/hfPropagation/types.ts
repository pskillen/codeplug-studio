/**
 * Core domain types for the HF/RF Propagation Visualiser.
 *
 * This is a growing scaffold — phase 1 (route/nav shell, #1163) only needs enough shape to type
 * the control panel's local state. Later phases (#1165, #1166, #1168) add `IonosphericLayerState`,
 * `RayTraceParams`, `RayPathResult`, and `PropagationMode` alongside these types, not in place of
 * them. `AntennaConfig.family`'s string-literal values are load-bearing: #1166's antenna pattern
 * functions switch on these exact strings, so do not rename them here.
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
