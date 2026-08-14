import { describe, expect, it } from 'vitest';
import { criticalFrequencyMhz, maximumUsableFrequencyMhz } from './mufCalculation.ts';
import { antennaGain } from './antennaPatterns.ts';
import { dLayerAttenuation, traceRay, traceRayFan } from './rayTrace.ts';
import type { AntennaConfig, IonosphericLayerState, RayTraceParams } from './types.ts';

const OMNIDIRECTIONAL: AntennaConfig = { family: 'omnidirectional-vertical', heightM: 8 };

/** Daytime F2-like layer: Ne,max = 1e12 e⁻/m³ → fc = 9 MHz. */
const F2_DAY: IonosphericLayerState = {
  id: 'F2',
  active: true,
  altitudeMinKm: 250,
  altitudeMaxKm: 400,
  peakElectronDensity: 1e12,
};

const ACTIVE_D: IonosphericLayerState = {
  id: 'D',
  active: true,
  altitudeMinKm: 60,
  altitudeMaxKm: 90,
  peakElectronDensity: 1e9, // fc ≈ 0.285 MHz — does not reflect typical HF
};

const INACTIVE_D: IonosphericLayerState = {
  id: 'D',
  active: false,
  altitudeMinKm: 60,
  altitudeMaxKm: 90,
  peakElectronDensity: 0,
};

const INACTIVE_F1: IonosphericLayerState = {
  id: 'F1',
  active: false,
  altitudeMinKm: 150,
  altitudeMaxKm: 250,
  peakElectronDensity: 0,
};

function params(overrides: Partial<RayTraceParams> = {}): RayTraceParams {
  return {
    frequencyMhz: 10,
    antenna: OMNIDIRECTIONAL,
    layers: [F2_DAY],
    azimuthDeg: 0,
    ...overrides,
  };
}

describe('traceRay', () => {
  it('classifies takeoff angles below 5° as groundwave regardless of frequency or layers', () => {
    const highFreq = traceRay(params({ frequencyMhz: 50, layers: [] }), 4);
    expect(highFreq.mode).toBe('groundwave');
    expect(highFreq.relativeSignalStrength).toBe(1);
    expect(highFreq.points).toEqual([
      { planeDistanceM: 0, altitudeKm: 0 },
      { planeDistanceM: 300_000, altitudeKm: 0 },
    ]);
    expect(traceRay(params(), 0).mode).toBe('groundwave');
  });

  it('classifies a frequency below layer MUF at 45° takeoff as skywave', () => {
    const takeoffAngleDeg = 45;
    const frequencyMhz = 10;
    const fc = criticalFrequencyMhz(F2_DAY.peakElectronDensity);
    const muf = maximumUsableFrequencyMhz(fc, takeoffAngleDeg);
    expect(fc).toBeCloseTo(9, 5);
    expect(muf).toBeCloseTo(12.7279, 3);
    expect(frequencyMhz).toBeLessThanOrEqual(muf);

    const result = traceRay(params({ frequencyMhz }), takeoffAngleDeg);
    expect(result.mode).toBe('skywave');
    expect(result.takeoffAngleDeg).toBe(45);
    expect(result.relativeSignalStrength).toBe(1);
    expect(result.points[0]).toEqual({ planeDistanceM: 0, altitudeKm: 0 });
    expect(result.points[1]?.altitudeKm).toBe(325); // F2 mid-altitude
    expect(result.points[1]?.planeDistanceM).toBeCloseTo(325_000, 0);
    expect(result.points[2]).toMatchObject({ altitudeKm: 0 });
    expect(result.points[2]?.planeDistanceM).toBeCloseTo(650_000, 0);
  });

  it('classifies a frequency below layer MUF at takeoff ≥ 70° as nvis', () => {
    const takeoffAngleDeg = 75;
    const frequencyMhz = 7;
    const fc = criticalFrequencyMhz(F2_DAY.peakElectronDensity);
    const muf = maximumUsableFrequencyMhz(fc, takeoffAngleDeg);
    expect(muf).toBeCloseTo(9.317, 2);
    expect(frequencyMhz).toBeLessThanOrEqual(muf);

    const result = traceRay(params({ frequencyMhz }), takeoffAngleDeg);
    expect(result.mode).toBe('nvis');
    expect(result.relativeSignalStrength).toBe(1);
    expect(result.points[1]?.altitudeKm).toBe(325);
  });

  it('classifies a frequency above the layer MUF as escaped', () => {
    const takeoffAngleDeg = 45;
    const frequencyMhz = 50;
    const muf = maximumUsableFrequencyMhz(
      criticalFrequencyMhz(F2_DAY.peakElectronDensity),
      takeoffAngleDeg,
    );
    expect(frequencyMhz).toBeGreaterThan(muf);

    const result = traceRay(params({ frequencyMhz }), takeoffAngleDeg);
    expect(result.mode).toBe('escaped');
    expect(result.relativeSignalStrength).toBe(0);
    expect(result.points).toHaveLength(2);
    expect(result.points[1]?.altitudeKm).toBeCloseTo(400 * 1.3);
  });

  it('returns escaped without crashing when every layer is inactive', () => {
    const result = traceRay(
      params({
        frequencyMhz: 14,
        layers: [INACTIVE_D, { ...F2_DAY, active: false }, INACTIVE_F1],
      }),
      45,
    );
    expect(result.mode).toBe('escaped');
    expect(result.relativeSignalStrength).toBe(0);
    expect(result.points[1]?.altitudeKm).toBeCloseTo(400 * 1.3);
  });

  it('uses the lowest active reflecting layer when several can support the frequency', () => {
    const eLayer: IonosphericLayerState = {
      id: 'E',
      active: true,
      altitudeMinKm: 90,
      altitudeMaxKm: 150,
      peakElectronDensity: 1e12, // same fc as F2, so MUF is identical
    };
    const result = traceRay(params({ frequencyMhz: 10, layers: [F2_DAY, eLayer] }), 45);
    expect(result.mode).toBe('skywave');
    expect(result.points[1]?.altitudeKm).toBe(120); // E mid-altitude, not F2's 325
  });

  it('attenuates skywave through an active D layer without reclassifying typical HF', () => {
    const result = traceRay(
      params({ frequencyMhz: 10, layers: [ACTIVE_D, F2_DAY] }),
      45,
    );
    expect(result.mode).toBe('skywave');
    expect(result.relativeSignalStrength).toBeCloseTo(0.70710678118, 8);
  });

  it('classifies a low-frequency low-takeoff ray as absorbed when the D layer is active', () => {
    const result = traceRay(
      params({ frequencyMhz: 0.4, layers: [ACTIVE_D, F2_DAY] }),
      10,
    );
    expect(result.mode).toBe('absorbed');
    expect(result.relativeSignalStrength).toBeCloseTo(0.01333333333, 8);
    expect(result.relativeSignalStrength).toBeLessThan(0.02);
  });

  it('reverts the same low-frequency case to skywave at night when the D layer is inactive', () => {
    const result = traceRay(
      params({ frequencyMhz: 0.4, layers: [INACTIVE_D, F2_DAY] }),
      10,
    );
    expect(result.mode).toBe('skywave');
    expect(result.relativeSignalStrength).toBe(1);
  });
});

describe('dLayerAttenuation', () => {
  it('returns 1.0 when the D layer is inactive (night)', () => {
    expect(dLayerAttenuation(0.4, false, 10)).toBe(1);
    expect(dLayerAttenuation(3, false, 10)).toBe(1);
  });

  it('increases absorption as frequency decreases', () => {
    const at10Mhz = dLayerAttenuation(10, true, 45);
    const at3Mhz = dLayerAttenuation(3, true, 45);
    expect(at10Mhz).toBeCloseTo(0.70710678118, 8);
    expect(at3Mhz).toBeCloseTo(0.21213203436, 8);
    expect(at3Mhz).toBeLessThan(at10Mhz);
  });

  it('increases absorption as takeoff angle decreases (longer D-layer path)', () => {
    const at45 = dLayerAttenuation(10, true, 45);
    const at10 = dLayerAttenuation(10, true, 10);
    expect(at10).toBeCloseTo(1 / 3, 8);
    expect(at10).toBeLessThan(at45);
  });
});

describe('traceRayFan', () => {
  const frequencyMhz = 10;

  it('returns rays sorted by takeoff angle and skips the groundwave band at 1–3° when gain is below threshold', () => {
    const fan = traceRayFan(params({ frequencyMhz }));
    const angles = fan.map((r) => r.takeoffAngleDeg);
    expect(angles).toEqual([...angles].sort((a, b) => a - b));
    expect(angles.every((a) => a >= 1 && a <= 89)).toBe(true);
    expect(angles.every((a) => (a - 1) % 2 === 0)).toBe(true);
    for (const ray of fan) {
      expect(
        antennaGain(OMNIDIRECTIONAL, ray.takeoffAngleDeg, 0, frequencyMhz),
      ).toBeGreaterThanOrEqual(0.05);
    }
  });

  it('produces the same ray count for an omnidirectional-vertical antenna at any azimuth', () => {
    const at0 = traceRayFan(params({ frequencyMhz, azimuthDeg: 0 }));
    const at90 = traceRayFan(params({ frequencyMhz, azimuthDeg: 90 }));
    const at180 = traceRayFan(params({ frequencyMhz, azimuthDeg: 180 }));
    expect(at0).toHaveLength(at90.length);
    expect(at0).toHaveLength(at180.length);
    expect(at0).toHaveLength(37);
    expect(at0[0]?.takeoffAngleDeg).toBe(3);
    expect(at0.at(-1)?.takeoffAngleDeg).toBe(75);
  });

  it('produces fewer rays for a directional-lobe antenna off its heading than on-axis', () => {
    const directional: AntennaConfig = {
      family: 'directional-lobe',
      heightM: 8,
      azimuthDeg: 0,
    };
    const onAxis = traceRayFan(params({ frequencyMhz, antenna: directional, azimuthDeg: 0 }));
    const offAxis = traceRayFan(params({ frequencyMhz, antenna: directional, azimuthDeg: 90 }));
    const reverse = traceRayFan(params({ frequencyMhz, antenna: directional, azimuthDeg: 180 }));
    expect(onAxis).toHaveLength(34);
    expect(onAxis[0]?.takeoffAngleDeg).toBe(23);
    expect(onAxis.at(-1)?.takeoffAngleDeg).toBe(89);
    expect(offAxis).toHaveLength(11);
    expect(reverse).toHaveLength(0);
    expect(onAxis.length).toBeGreaterThan(offAxis.length);
  });
});
