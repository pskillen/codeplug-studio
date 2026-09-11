import { describe, expect, it } from 'vitest';
import gb from './data/gb.ts';
import ie from './data/ie.ts';
import { PUBLIC_SERVICE_COUNTRY_SUMMARIES } from './data/index.generated.ts';
import type { PublicServiceCountry, PublicServiceEntry } from './types.ts';

const COUNTRIES: readonly PublicServiceCountry[] = [gb, ie];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FREQ_MIN_HZ = 25_000_000;
const FREQ_MAX_HZ = 1_000_000_000;

function isAscii(value: string): boolean {
  return [...value].every((ch) => ch.charCodeAt(0) <= 127);
}

describe('public-service dataset integrity', () => {
  it('registers every generated country in the summary index', () => {
    expect(PUBLIC_SERVICE_COUNTRY_SUMMARIES.map((row) => row.countryCode).sort()).toEqual(
      COUNTRIES.map((country) => country.countryCode).sort(),
    );
  });

  it.each(COUNTRIES)('$countryCode passes the corpus schema checks', (country) => {
    const names = new Set<string>();
    const ids = new Set<string>();

    expect(country.countryCode).toMatch(/^[A-Z]{2}$/);
    expect(country.countryLabel.length).toBeGreaterThan(0);
    expect(country.groups.length).toBeGreaterThan(0);

    for (const group of country.groups) {
      expect(group.groupId).toMatch(SLUG);
      expect(group.groupId.startsWith(`${country.countryCode.toLowerCase()}-`)).toBe(true);
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.label.length).toBeLessThanOrEqual(60);

      for (const entry of group.entries) {
        const idKey = `${group.groupId}/${entry.channelId}`;
        expect(ids.has(idKey)).toBe(false);
        ids.add(idKey);

        expect(entry.channelId).toMatch(SLUG);
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.name.length).toBeLessThanOrEqual(16);
        expect(isAscii(entry.name)).toBe(true);

        const nameKey = entry.name.trim().toLowerCase();
        expect(names.has(nameKey), `${country.countryCode} duplicate name ${entry.name}`).toBe(
          false,
        );
        names.add(nameKey);

        expect(Number.isInteger(entry.rxFrequencyHz)).toBe(true);
        expect(Number.isInteger(entry.txFrequencyHz)).toBe(true);
        expect(entry.rxFrequencyHz).toBeGreaterThanOrEqual(FREQ_MIN_HZ);
        expect(entry.rxFrequencyHz).toBeLessThanOrEqual(FREQ_MAX_HZ);
        expect(entry.txFrequencyHz).toBeGreaterThanOrEqual(FREQ_MIN_HZ);
        expect(entry.txFrequencyHz).toBeLessThanOrEqual(FREQ_MAX_HZ);

        const simplex = entry.rxFrequencyHz === entry.txFrequencyHz;
        if (!simplex) {
          expect(Math.abs(entry.txFrequencyHz - entry.rxFrequencyHz)).toBeGreaterThanOrEqual(
            100_000,
          );
        }

        expect(entry.modes.length).toBeGreaterThan(0);
        expect(entry.modes.filter((mode) => mode.isPrimary)).toHaveLength(1);
        expect(entry.source.url.startsWith('http')).toBe(true);
        expect(entry.source.title.length).toBeGreaterThan(0);
        assertModeFields(entry);
      }
    }
  });

  it('collapses GB fireground dual-mode rows into eight channels', () => {
    const fire = gb.groups.find((group) => group.groupId === 'gb-ukfrs-fireground');
    expect(fire?.entries).toHaveLength(8);
    expect(fire?.entries.every((entry) => entry.modes.length === 2)).toBe(true);
    expect(fire?.entries.every((entry) => entry.modes.find((m) => m.isPrimary)?.mode === 'dmr')).toBe(
      true,
    );
  });
});

function assertModeFields(entry: PublicServiceEntry): void {
  for (const spec of entry.modes) {
    if (spec.mode === 'fm') {
      expect(spec.colourCode).toBeUndefined();
      expect(spec.timeslot).toBeUndefined();
    } else {
      expect(spec.bandwidthKHz).toBeUndefined();
      expect(spec.rxTone).toBeUndefined();
      expect(spec.txTone).toBeUndefined();
    }
  }
}
