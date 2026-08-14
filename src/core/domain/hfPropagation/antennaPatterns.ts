import type { AntennaConfig } from './types.ts';

const SPEED_OF_LIGHT_M_PER_S = 299_792_458;

/** Wavelength in metres for a given frequency in MHz — c / f. */
export function wavelengthM(frequencyMhz: number): number {
  return SPEED_OF_LIGHT_M_PER_S / (frequencyMhz * 1e6);
}

/**
 * Ground-reflection factor for a horizontal antenna at height h (metres) above ground, at
 * elevation angle thetaDeg, wavelength lambdaM. Governs NVIS-vs-DX behaviour for family 2.
 */
export function groundReflectionFactor(thetaDeg: number, heightM: number, lambdaM: number): number {
  const thetaRad = (thetaDeg * Math.PI) / 180;
  return 2 * Math.sin(((2 * Math.PI * heightM) / lambdaM) * Math.sin(thetaRad));
}

/**
 * Antenna gain (relative, not absolute dBi — this is a shape function for ray-tracing input
 * power weighting, not a calibrated antenna model) at elevation thetaDeg and azimuth phiDeg,
 * for the given antenna configuration and operating frequency. Returns a value in [0, ~2] — the
 * caller (ray tracer, #1168) treats this as a multiplicative weight on transmit power, not dBi.
 */
export function antennaGain(
  antenna: AntennaConfig,
  thetaDeg: number,
  phiDeg: number,
  frequencyMhz: number,
): number {
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const lambdaM = wavelengthM(frequencyMhz);

  switch (antenna.family) {
    case 'omnidirectional-vertical': {
      // A(phi) = 1 (constant); E(theta) = sin(theta) * cos(pi/2 * sin theta)
      return Math.sin(thetaRad) * Math.cos((Math.PI / 2) * Math.sin(thetaRad));
    }
    case 'bidirectional-transverse': {
      const phi0 = antenna.azimuthDeg ?? 0;
      const azimuthGain = Math.abs(Math.cos(((phiDeg - phi0) * Math.PI) / 180));
      const groundFactor = groundReflectionFactor(thetaDeg, antenna.heightM, lambdaM);
      return azimuthGain * Math.abs(groundFactor);
    }
    case 'directional-lobe': {
      const phi0 = antenna.azimuthDeg ?? 0;
      const BEAMWIDTH_EXPONENT_N = 4; // fixed reasonable default beamwidth — not user-adjustable in v1
      const LOW_ANGLE_EXPONENT_M = 3;
      const azimuthGain = Math.cos(((phiDeg - phi0) * Math.PI) / 360) ** (2 * BEAMWIDTH_EXPONENT_N);
      const elevationGain = Math.sin(thetaRad) ** LOW_ANGLE_EXPONENT_M;
      return azimuthGain * elevationGain;
    }
    case 'multi-lobe-conical': {
      const wireLengthWavelengths = antenna.wireLengthWavelengths ?? 2;
      if (thetaRad === 0 || thetaRad === Math.PI) return 0; // avoid division by zero at poles
      const denominator = 1 - Math.cos(thetaRad);
      if (Math.abs(denominator) < 1e-9) return 0;
      const numerator = Math.sin(thetaRad);
      const phase = Math.PI * wireLengthWavelengths * denominator;
      return Math.abs((numerator / denominator) * Math.sin(phase));
    }
  }
}
