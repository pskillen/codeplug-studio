import { describe, expect, it } from 'vitest';
import { antennaGain, groundReflectionFactor, wavelengthM } from './antennaPatterns.ts';
import type { AntennaConfig } from './types.ts';

function peakThetaDeg(antenna: AntennaConfig, phiDeg: number, frequencyMhz: number): number {
  let bestTheta = 0;
  let bestGain = Number.NEGATIVE_INFINITY;
  for (let thetaDeg = 0; thetaDeg <= 90; thetaDeg += 1) {
    const gain = antennaGain(antenna, thetaDeg, phiDeg, frequencyMhz);
    if (gain > bestGain) {
      bestGain = gain;
      bestTheta = thetaDeg;
    }
  }
  return bestTheta;
}

const HF_FREQUENCY_MHZ = 14.2;

describe('wavelengthM', () => {
  it('returns ~21.1 m at 14.2 MHz', () => {
    expect(wavelengthM(HF_FREQUENCY_MHZ)).toBeCloseTo(21.112, 3);
  });
});

describe('antennaGain', () => {
  describe('omnidirectional-vertical', () => {
    const antenna: AntennaConfig = { family: 'omnidirectional-vertical', heightM: 8 };

    it('has an overhead null at theta=90°', () => {
      expect(antennaGain(antenna, 90, 0, HF_FREQUENCY_MHZ)).toBeCloseTo(0, 10);
    });

    it('is azimuth-independent for a fixed elevation', () => {
      const at0 = antennaGain(antenna, 30, 0, HF_FREQUENCY_MHZ);
      const at90 = antennaGain(antenna, 30, 90, HF_FREQUENCY_MHZ);
      const at180 = antennaGain(antenna, 30, 180, HF_FREQUENCY_MHZ);
      expect(at90).toBeCloseTo(at0, 10);
      expect(at180).toBeCloseTo(at0, 10);
    });
  });

  describe('bidirectional-transverse', () => {
    const antenna: AntennaConfig = {
      family: 'bidirectional-transverse',
      heightM: 8,
      azimuthDeg: 0,
    };

    it('has figure-8 azimuth nulls at phi0 ± 90°', () => {
      expect(antennaGain(antenna, 30, 90, HF_FREQUENCY_MHZ)).toBeCloseTo(0, 10);
      expect(antennaGain(antenna, 30, -90, HF_FREQUENCY_MHZ)).toBeCloseTo(0, 10);
      expect(antennaGain(antenna, 30, 0, HF_FREQUENCY_MHZ)).toBeGreaterThan(0);
    });

    it('peaks at theta=90° for low h/λ (NVIS, 0.1) and near 30° for h/λ=0.5', () => {
      const lambdaM = wavelengthM(HF_FREQUENCY_MHZ);
      const low = 0.1 * lambdaM;
      const standard = 0.5 * lambdaM;

      const lowAt90 = Math.abs(groundReflectionFactor(90, low, lambdaM));
      const lowAt30 = Math.abs(groundReflectionFactor(30, low, lambdaM));
      expect(lowAt90).toBeGreaterThan(lowAt30);

      const stdAt90 = Math.abs(groundReflectionFactor(90, standard, lambdaM));
      const stdAt30 = Math.abs(groundReflectionFactor(30, standard, lambdaM));
      expect(stdAt90).toBeCloseTo(0, 10);
      expect(stdAt30).toBeGreaterThan(stdAt90);

      const nvis: AntennaConfig = {
        family: 'bidirectional-transverse',
        heightM: low,
        azimuthDeg: 0,
      };
      expect(peakThetaDeg(nvis, 0, HF_FREQUENCY_MHZ)).toBe(90);

      const dx: AntennaConfig = {
        family: 'bidirectional-transverse',
        heightM: standard,
        azimuthDeg: 0,
      };
      expect(peakThetaDeg(dx, 0, HF_FREQUENCY_MHZ)).toBe(30);
    });
  });

  describe('directional-lobe', () => {
    const antenna: AntennaConfig = {
      family: 'directional-lobe',
      heightM: 8,
      azimuthDeg: 45,
    };

    it('peaks at the heading azimuth and falls off symmetrically', () => {
      const onAxis = antennaGain(antenna, 20, 45, HF_FREQUENCY_MHZ);
      const left = antennaGain(antenna, 20, 25, HF_FREQUENCY_MHZ);
      const right = antennaGain(antenna, 20, 65, HF_FREQUENCY_MHZ);
      expect(onAxis).toBeGreaterThan(left);
      expect(onAxis).toBeGreaterThan(right);
      expect(left).toBeCloseTo(right, 10);
    });
  });

  describe('multi-lobe-conical', () => {
    const antenna: AntennaConfig = {
      family: 'multi-lobe-conical',
      heightM: 8,
      wireLengthWavelengths: 2,
    };

    it('does not produce NaN at the poles', () => {
      expect(antennaGain(antenna, 0, 0, HF_FREQUENCY_MHZ)).toBe(0);
      expect(antennaGain(antenna, 180, 0, HF_FREQUENCY_MHZ)).toBe(0);
      expect(Number.isFinite(antennaGain(antenna, 0, 0, HF_FREQUENCY_MHZ))).toBe(true);
      expect(Number.isFinite(antennaGain(antenna, 180, 0, HF_FREQUENCY_MHZ))).toBe(true);
    });
  });
});
