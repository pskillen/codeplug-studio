import { solarZenithAngleDeg } from './solarZenithAngle.ts';
import type { IonosphericLayerId, IonosphericLayerState, SolarActivityPreset } from './types.ts';

interface LayerBand {
  id: IonosphericLayerId;
  altitudeMinKm: number;
  altitudeMaxKm: number;
  dayOnly: boolean; // D and F1
}

const LAYER_BANDS: LayerBand[] = [
  { id: 'D', altitudeMinKm: 60, altitudeMaxKm: 90, dayOnly: true },
  { id: 'E', altitudeMinKm: 90, altitudeMaxKm: 150, dayOnly: false },
  { id: 'F1', altitudeMinKm: 150, altitudeMaxKm: 250, dayOnly: true },
  { id: 'F2', altitudeMinKm: 250, altitudeMaxKm: 400, dayOnly: false },
];

/** Night-time F2 lower bound — merged F-region occupies F1's daytime band as well. */
const NIGHT_F2_ALTITUDE_MIN_KM = 150;

/**
 * Canned peak-density baselines (electrons/m³) per solar preset. Order-of-magnitude
 * daytime F2 Ne,max — this is an idealised teaching tool, not a space-weather service.
 * Chosen so `fc ≈ 9·√Ne,max` lands in the ~3–15 MHz amateur F2 daytime range.
 */
const SOLAR_PRESET_PEAK_DENSITY: Record<SolarActivityPreset, number> = {
  quiet: 5e11,
  moderate: 1e12,
  'solar-max': 2e12,
  storm: 8e11, // storms typically depress F2 density despite raising Kp
};

/** Zenith angles above this count as night, with a dusk/dawn band rather than a hard 90° cutoff. */
const NIGHT_ZENITH_DEG = 100;
/** E/F2 retain this fraction of daytime peak density after sunset. */
const NIGHT_DENSITY_FRACTION = 0.3;

/**
 * Compute the four layers' activation/density state for a transmitter location, instant, and
 * solar preset. D and F1 deactivate at night (solar zenith angle > ~100°); E and F2 stay active
 * day and night with reduced night-time density. At night F2's `altitudeMinKm` drops to 150 km
 * so the remaining F-region shell fills F1's vacated band (no geometric gap).
 */
export function computeIonosphericLayers(
  latDeg: number,
  lonDeg: number,
  atMs: number,
  preset: SolarActivityPreset,
): IonosphericLayerState[] {
  const zenithDeg = solarZenithAngleDeg(latDeg, lonDeg, atMs);
  const isDaylight = zenithDeg < NIGHT_ZENITH_DEG;
  const peakDensityBaseline = SOLAR_PRESET_PEAK_DENSITY[preset];

  return LAYER_BANDS.map((band) => {
    const active = band.dayOnly ? isDaylight : true;
    const nightFraction = isDaylight ? 1 : NIGHT_DENSITY_FRACTION;
    const altitudeMinKm =
      band.id === 'F2' && !isDaylight ? NIGHT_F2_ALTITUDE_MIN_KM : band.altitudeMinKm;
    return {
      id: band.id,
      active,
      altitudeMinKm,
      altitudeMaxKm: band.altitudeMaxKm,
      peakElectronDensity: active ? peakDensityBaseline * nightFraction : 0,
    };
  });
}
