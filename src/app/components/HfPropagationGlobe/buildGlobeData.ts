/** Extra radial separation per layer when exploded stacking is on, in globe-radius units. */
export const EXPLODE_OFFSET_PER_LAYER = 0.15;

/**
 * Exaggerates an altitude for display purposes only — physics/positioning elsewhere in the
 * app must keep using the real altitudeKm. factor 1 (or exaggeration disabled) is a no-op.
 */
export function exaggeratedAltitudeKm(altitudeKm: number, factor: number): number {
  if (!Number.isFinite(factor) || factor <= 1) return altitudeKm;
  return altitudeKm * factor;
}

/**
 * Additional radial separation (in the same globe-radius units `altitudeKmToGlobeRadiusUnits`
 * produces) for exploded-layer-stacking mode, keyed by layer index (0 = D, 1 = E, 2 = F1, 3 =
 * F2) so lower layers get less separation than higher ones and the stack still reads bottom-up.
 */
export function explodeOffsetUnits(layerIndex: number, enabled: boolean): number {
  if (!enabled) return 0;
  return layerIndex * EXPLODE_OFFSET_PER_LAYER;
}
