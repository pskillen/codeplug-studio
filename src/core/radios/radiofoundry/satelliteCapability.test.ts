import { describe, expect, it } from 'vitest';
import validTle from '@core/domain/tle/__fixtures__/valid.tle?raw';
import {
  isRadioFoundrySatelliteFmMode,
  radioFoundrySatelliteProblem,
  radioFoundrySatelliteProfile,
  radioFoundryTransmitterProblem,
  type RadioFoundryBand,
} from './satelliteCapability.ts';

const BANDS: RadioFoundryBand[] = [
  { minHz: 136_000_000, maxHz: 174_000_000 },
  { minHz: 400_000_000, maxHz: 480_000_000 },
];

function tleLine1(catalog: number, epochField: string): string {
  const cat = String(catalog).padStart(5, '0');
  const line =
    `1 ${cat}U 98067A   ${epochField}  .00016717 00000-0  10230-3 0  9990`;
  if (line.length !== 69) throw new Error(`line1 length ${line.length}`);
  return line;
}

function validPair(): { line1: string; line2: string } {
  const blocks = validTle.trim().split(/\n\n+/);
  const iss = blocks[0]!.trim().split('\n');
  return { line1: iss[1]!, line2: iss[2]! };
}

describe('isRadioFoundrySatelliteFmMode', () => {
  it('accepts FM spellings and an empty mode', () => {
    expect(isRadioFoundrySatelliteFmMode('FM')).toBe(true);
    expect(isRadioFoundrySatelliteFmMode('nfm')).toBe(true);
    expect(isRadioFoundrySatelliteFmMode('fm-narrow')).toBe(true);
    expect(isRadioFoundrySatelliteFmMode(null)).toBe(true);
    expect(isRadioFoundrySatelliteFmMode('')).toBe(true);
    expect(isRadioFoundrySatelliteFmMode('CW')).toBe(false);
    expect(isRadioFoundrySatelliteFmMode('BPSK')).toBe(false);
    expect(isRadioFoundrySatelliteFmMode('DMR')).toBe(false);
  });
});

describe('radioFoundryTransmitterProblem', () => {
  it('needs an uplink and a downlink in band', () => {
    expect(
      radioFoundryTransmitterProblem(
        { mode: 'FM', uplinkHz: null, downlinkHz: 436_795_000, uplinkToneHz: null },
        BANDS,
      ),
    ).toBe('RadioFoundry needs an uplink frequency to track a satellite.');
    expect(
      radioFoundryTransmitterProblem(
        { mode: 'FM', uplinkHz: 145_850_000, downlinkHz: 0, uplinkToneHz: null },
        BANDS,
      ),
    ).toBe('RadioFoundry needs a downlink frequency to track a satellite.');
    expect(
      radioFoundryTransmitterProblem(
        {
          mode: 'FM',
          uplinkHz: 10_489_500_000,
          downlinkHz: 10_489_500_000,
          uplinkToneHz: null,
        },
        BANDS,
      ),
    ).toBe("Its uplink or downlink is outside this radio's bands.");
    expect(
      radioFoundryTransmitterProblem(
        {
          mode: 'FM',
          uplinkHz: 145_850_000,
          downlinkHz: 436_795_000,
          uplinkToneHz: null,
        },
        BANDS,
      ),
    ).toBe(null);
  });

  it('checks the uplink tone range', () => {
    const base = { mode: 'FM', uplinkHz: 145_850_000, downlinkHz: 436_795_000 };
    expect(radioFoundryTransmitterProblem({ ...base, uplinkToneHz: 67 }, BANDS)).toBe(null);
    expect(radioFoundryTransmitterProblem({ ...base, uplinkToneHz: 59.9 }, BANDS)).toBe(
      'Its uplink tone is outside 60.0–260.0 Hz.',
    );
    expect(radioFoundryTransmitterProblem({ ...base, uplinkToneHz: 260 }, BANDS)).toBe(null);
    expect(radioFoundryTransmitterProblem({ ...base, uplinkToneHz: null }, BANDS)).toBe(null);
  });
});

describe('radioFoundrySatelliteProblem', () => {
  it('refuses catalog numbers past 99999 and malformed TLEs', () => {
    const { line1, line2 } = validPair();
    expect(
      radioFoundrySatelliteProblem({ noradId: 100_000, tleLine1: line1, tleLine2: line2 }),
    ).toBe('RadioFoundry stores catalog numbers up to 99999 only.');
    expect(radioFoundrySatelliteProblem({ noradId: 0, tleLine1: line1, tleLine2: line2 })).toBe(
      'RadioFoundry stores catalog numbers up to 99999 only.',
    );
  const short = line1.slice(0, 68);
    expect(
      radioFoundrySatelliteProblem({ noradId: 25544, tleLine1: short, tleLine2: line2 }),
    ).toBe('Its TLE is not two 69-character lines.');
    const tabbed = `${line1.slice(0, 10)}\t${line1.slice(11)}`;
    expect(
      radioFoundrySatelliteProblem({ noradId: 25544, tleLine1: tabbed, tleLine2: line2 }),
    ).toBe('Its TLE is not two 69-character lines.');
    const badClass = `${line1.slice(0, 7)}X${line1.slice(8)}`;
    expect(
      radioFoundrySatelliteProblem({ noradId: 25544, tleLine1: badClass, tleLine2: line2 }),
    ).toBe('Its TLE classification is not U, C or S.');
    expect(
      radioFoundrySatelliteProblem({ noradId: 25544, tleLine1: line1, tleLine2: line2 }),
    ).toBe(null);
  });
});

describe('radioFoundrySatelliteProfile', () => {
  it('builds the profile from downlink, uplink and uplink tone', () => {
    expect(
      radioFoundrySatelliteProfile(
        27_607,
        {
          mode: 'FM',
          uplinkHz: 145_850_000,
          downlinkHz: 436_795_000,
          uplinkToneHz: 67,
        },
        BANDS,
      ),
    ).toEqual({
      catalogId: 27_607,
      rxHz: 436_795_000,
      txHz: 145_850_000,
      toneTenths: 670,
    });
    expect(
      radioFoundrySatelliteProfile(
        27_607,
        {
          mode: 'FM',
          uplinkHz: 145_850_000,
          downlinkHz: 436_795_000,
          uplinkToneHz: null,
        },
        BANDS,
      ),
    ).toMatchObject({ toneTenths: 0 });
    expect(() =>
      radioFoundrySatelliteProfile(
        27_607,
        { mode: 'DMR', uplinkHz: 145_850_000, downlinkHz: 436_795_000, uplinkToneHz: null },
        BANDS,
      ),
    ).toThrow();
  });
});

export function tle(catalog: number, epoch: string): { line1: string; line2: string } {
  const cat = String(catalog).padStart(5, '0');
  const line2 = `2 ${cat}  51.6416 247.4627 0006703 130.5360 325.0288 15.49560319 99999`;
  if (line2.length !== 69) throw new Error(`line2 length ${line2.length}`);
  return { line1: tleLine1(catalog, epoch), line2 };
}