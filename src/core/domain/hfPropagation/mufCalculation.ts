/**
 * Critical frequency (MHz) for vertical-incidence reflection off a layer with given peak
 * electron density (electrons/m³). Standard approximation: fc ≈ 9 × √Ne,max, with Ne,max
 * in electrons/m³ and fc in Hz — divide by 1e6 for MHz.
 */
export function criticalFrequencyMhz(peakElectronDensity: number): number {
  if (peakElectronDensity <= 0) return 0;
  return (9 * Math.sqrt(peakElectronDensity)) / 1e6;
}

/**
 * Maximum usable frequency (MHz) for a given takeoff angle (degrees above horizon) reflecting
 * off a layer with critical frequency fcMhz. fMUF = fc · sec(incidence angle), using the
 * standard secant-law approximation `sec(90° - takeoffAngleDeg)` for a flat-Earth single-hop.
 */
export function maximumUsableFrequencyMhz(fcMhz: number, takeoffAngleDeg: number): number {
  const incidenceAngleRad = ((90 - takeoffAngleDeg) * Math.PI) / 180;
  const cosIncidence = Math.cos(incidenceAngleRad);
  if (cosIncidence === 0) return Number.POSITIVE_INFINITY;
  return fcMhz / cosIncidence;
}
