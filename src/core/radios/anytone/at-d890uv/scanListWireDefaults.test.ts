import { describe, expect, it } from 'vitest';
import {
  AT_D890_SCAN_TIMING_DECISECONDS,
  AT_D890_SCAN_TIMING_SECONDS_CSV,
  resolveAtD890ScanListTiming,
} from './scanListWireDefaults.ts';

describe('resolveAtD890ScanListTiming', () => {
  it('defaults to 3.0 s / 30 ds when unset', () => {
    const resolved = resolveAtD890ScanListTiming();
    expect(resolved.csv.lookBackA).toBe(AT_D890_SCAN_TIMING_SECONDS_CSV);
    expect(resolved.csv.lookBackB).toBe(AT_D890_SCAN_TIMING_SECONDS_CSV);
    expect(resolved.csv.dropoutDelay).toBe(AT_D890_SCAN_TIMING_SECONDS_CSV);
    expect(resolved.csv.dwellTime).toBe(AT_D890_SCAN_TIMING_SECONDS_CSV);
    expect(resolved.deciseconds.lookBackA).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(resolved.deciseconds.lookBackB).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(resolved.deciseconds.dropoutDelay).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(resolved.deciseconds.dwellTime).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
  });

  it('clamps look-back fields to 0.5–5.0 s', () => {
    const resolved = resolveAtD890ScanListTiming({
      scanListLookBackASeconds: 0.1,
      scanListLookBackBSeconds: 9,
    });
    expect(resolved.csv.lookBackA).toBe('0.5');
    expect(resolved.csv.lookBackB).toBe('5.0');
    expect(resolved.deciseconds.lookBackA).toBe(5);
    expect(resolved.deciseconds.lookBackB).toBe(50);
  });

  it('clamps dropout and dwell to 0.1–5.0 s', () => {
    const resolved = resolveAtD890ScanListTiming({
      scanListDropoutDelaySeconds: 0.05,
      scanListDwellTimeSeconds: 6,
    });
    expect(resolved.csv.dropoutDelay).toBe('0.1');
    expect(resolved.csv.dwellTime).toBe('5.0');
    expect(resolved.deciseconds.dropoutDelay).toBe(1);
    expect(resolved.deciseconds.dwellTime).toBe(50);
  });

  it('rounds to 0.1 s for CSV and decisecond parity', () => {
    const resolved = resolveAtD890ScanListTiming({
      scanListLookBackASeconds: 2.04,
      scanListDropoutDelaySeconds: 1.96,
    });
    expect(resolved.csv.lookBackA).toBe('2.0');
    expect(resolved.deciseconds.lookBackA).toBe(20);
    expect(resolved.csv.dropoutDelay).toBe('2.0');
    expect(resolved.deciseconds.dropoutDelay).toBe(20);
  });

  it('uses custom values within bounds', () => {
    const resolved = resolveAtD890ScanListTiming({
      scanListLookBackASeconds: 2.5,
      scanListLookBackBSeconds: 4.0,
      scanListDropoutDelaySeconds: 1.5,
      scanListDwellTimeSeconds: 3.1,
    });
    expect(resolved.csv).toEqual({
      lookBackA: '2.5',
      lookBackB: '4.0',
      dropoutDelay: '1.5',
      dwellTime: '3.1',
    });
    expect(resolved.deciseconds).toEqual({
      lookBackA: 25,
      lookBackB: 40,
      dropoutDelay: 15,
      dwellTime: 31,
    });
  });
});
