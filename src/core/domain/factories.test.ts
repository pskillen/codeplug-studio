import { describe, expect, it } from 'vitest';
import { duplicateChannel, newChannel } from './factories.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('duplicateChannel', () => {
  it('copies RF fields under a new id and a "(copy)" name', () => {
    const source = newChannel(projectId, 'Newry', 'GB3NY');
    source.rxFrequency = 439_550_000;
    source.location = { lat: 54.17, lon: -6.34 };
    source.modeProfiles = [
      { mode: 'fm', rxTone: '110.9', txTone: '110.9', squelch: null, bandwidthKHz: 12.5 },
    ];
    const copy = duplicateChannel(projectId, source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('Newry (copy)');
    expect(copy.callsign).toBe('GB3NY');
    expect(copy.rxFrequency).toBe(439_550_000);
    expect(copy.location).toEqual(source.location);
    expect(copy.modeProfiles).toEqual(source.modeProfiles);
    expect(copy.modeProfiles[0]).not.toBe(source.modeProfiles[0]);
  });
});
