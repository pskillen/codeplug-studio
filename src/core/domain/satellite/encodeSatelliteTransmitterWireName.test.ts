import { describe, expect, it } from 'vitest';
import {
  encodeSatelliteTransmitterWireName,
  trimEncodedWireName,
} from './encodeSatelliteTransmitterWireName.ts';

describe('encodeSatelliteTransmitterWireName', () => {
  it('appends transmitter label when satellite short name fits with room', () => {
    expect(trimEncodedWireName(encodeSatelliteTransmitterWireName('ISS', 'FM', 8))).toBe('ISS FM');
  });

  it('uses satellite short name only when it fills the budget', () => {
    expect(encodeSatelliteTransmitterWireName('GREENCUB', 'FM', 8)).toBe('GREENCUB');
  });
});
