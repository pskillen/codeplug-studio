import { describe, expect, it } from 'vitest';
import { detectAirportQueryKind } from './queryRouter.ts';

describe('detectAirportQueryKind', () => {
  it('detects ICAO codes', () => {
    expect(detectAirportQueryKind('EGPF')).toBe('icao');
    expect(detectAirportQueryKind('egpf')).toBe('icao');
  });

  it('detects IATA codes', () => {
    expect(detectAirportQueryKind('GLA')).toBe('iata');
  });

  it('detects locators', () => {
    expect(detectAirportQueryKind('IO85mm')).toBe('locator');
  });

  it('defaults to town/name search', () => {
    expect(detectAirportQueryKind('Glasgow')).toBe('town');
    expect(detectAirportQueryKind('')).toBe('name');
  });
});
