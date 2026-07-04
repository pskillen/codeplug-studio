import type { ChannelSetTemplate } from './types.ts';

const KHZ = 1_000;
const MHZ = 1_000_000;

/** Build a linear frequency grid in Hz. */
export function buildLinearGridHz(
  startHz: number,
  count: number,
  stepHz: number,
): readonly number[] {
  return Array.from({ length: count }, (_, i) => startHz + i * stepHz);
}

export const UK_VHF_SIMPLEX_HZ = buildLinearGridHz(145_200_000, 30, 12_500);
export const UK_UHF_SIMPLEX_HZ = buildLinearGridHz(433_400_000, 17, 12_500);

/** V16…V45 naming for UK VHF FM simplex grid. */
export function ukVhfSimplexVName(index: number): string {
  return `V${16 + index}`;
}

/**
 * Legacy S-channel names aligned to the V16–V45 grid (S20 = 145.500 MHz).
 * Even slots use historic S08–S22; odd slots use S17–S45 (parallel label, no historic S).
 */
export function ukVhfSimplexSName(index: number): string {
  if (index % 2 === 0) {
    return `S${8 + index / 2}`;
  }
  return `S${16 + index}`;
}

export const UK_VHF_SIMPLEX_S_NAMES: readonly string[] = UK_VHF_SIMPLEX_HZ.map((_, i) =>
  ukVhfSimplexSName(i),
);

/** U272…U288 (current RSGB simplex designators). */
export function ukUhfSimplexUName(index: number): string {
  return `U${272 + index}`;
}

/** U16…U32 (legacy numbering at the same frequencies as U272–U288). */
export function ukUhfSimplexLegacyName(index: number): string {
  return `U${16 + index}`;
}

function simplexTemplates(
  frequenciesHz: readonly number[],
  nameFn: (index: number) => string,
): ChannelSetTemplate[] {
  return frequenciesHz.map((hz, index) => ({
    name: nameFn(index),
    rxFrequencyHz: hz,
    txFrequencyHz: hz,
  }));
}

export function ukVhfSimplexVTemplates(): ChannelSetTemplate[] {
  return simplexTemplates(UK_VHF_SIMPLEX_HZ, ukVhfSimplexVName);
}

export function ukVhfSimplexSTemplates(): ChannelSetTemplate[] {
  return simplexTemplates(UK_VHF_SIMPLEX_HZ, ukVhfSimplexSName);
}

export function ukUhfSimplexUTemplates(): ChannelSetTemplate[] {
  return simplexTemplates(UK_UHF_SIMPLEX_HZ, ukUhfSimplexUName);
}

export function ukUhfSimplexLegacyTemplates(): ChannelSetTemplate[] {
  return simplexTemplates(UK_UHF_SIMPLEX_HZ, ukUhfSimplexLegacyName);
}

/** ETSI PMR446: 16 channels, 12.5 kHz spacing from 446.00625 MHz. */
export function pmr446Templates(): ChannelSetTemplate[] {
  const startHz = 446_006_250;
  return Array.from({ length: 16 }, (_, i) => {
    const hz = startHz + i * 12_500;
    return {
      name: `PMR446-${i + 1}`,
      rxFrequencyHz: hz,
      txFrequencyHz: hz,
    };
  });
}

/** UK 27/81 CB: 40 channels, 10 kHz spacing from 27.60125 MHz. */
export function ukCb2781Templates(): ChannelSetTemplate[] {
  const startHz = Math.round(27.60125 * MHZ);
  const stepHz = 10 * KHZ;
  return Array.from({ length: 40 }, (_, i) => {
    const hz = startHz + i * stepHz;
    return {
      name: `UK CB ${i + 1}`,
      rxFrequencyHz: hz,
      txFrequencyHz: hz,
    };
  });
}

/** EU / CEPT CB: 40 channels, 10 kHz spacing from 26.965 MHz. */
export function euCbCeptTemplates(): ChannelSetTemplate[] {
  const startHz = Math.round(26.965 * MHZ);
  const stepHz = 10 * KHZ;
  return Array.from({ length: 40 }, (_, i) => {
    const hz = startHz + i * stepHz;
    return {
      name: `EU CB ${i + 1}`,
      rxFrequencyHz: hz,
      txFrequencyHz: hz,
    };
  });
}
