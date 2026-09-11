import { describe, expect, it } from 'vitest';
import { generateChannelsFromGroups } from './generate.ts';
import gb from './data/gb.ts';
import ie from './data/ie.ts';
import type { PublicServiceCountry } from './types.ts';

const COUNTRIES: readonly PublicServiceCountry[] = [gb, ie];

describe('public-service transmit guarantee', () => {
  it('forbids transmit on every generated channel from every registered country', () => {
    for (const country of COUNTRIES) {
      const groupIds = country.groups.map((group) => group.groupId);
      const channels = generateChannelsFromGroups('proj-1', country, groupIds);
      expect(channels.length).toBeGreaterThan(0);
      for (const channel of channels) {
        expect(channel.forbidTransmit, `${country.countryCode} ${channel.name}`).toBe('forbid');
        expect(channel.txFrequency).not.toBeNull();
        expect(channel.rxFrequency).not.toBeNull();
      }
    }
  });
});
