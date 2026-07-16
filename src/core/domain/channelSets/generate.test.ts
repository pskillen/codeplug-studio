import { describe, expect, it } from 'vitest';
import { newChannel } from '../factories.ts';
import { classifyChannelSetDedup } from './dedup.ts';
import { generateChannelsFromSet } from './generate.ts';

const PROJECT_ID = 'proj-1';

describe('generateChannelsFromSet', () => {
  it('generates PMR446 with forbidTransmit default', () => {
    const channels = generateChannelsFromSet(PROJECT_ID, 'pmr446');
    expect(channels).toHaveLength(16);
    expect(channels.every((ch) => ch.forbidTransmit === 'forbid')).toBe(true);
    expect(channels[0]?.modeProfiles[0]).toMatchObject({
      mode: 'fm',
      bandwidthKHz: 12.5,
    });
  });

  it('applies name prefix and overrides', () => {
    const channels = generateChannelsFromSet(PROJECT_ID, 'uk-vhf-simplex-v', {
      namePrefix: 'TEST-',
      power: 25,
      forbidTransmit: true,
      bandwidthKHz: 25,
    });
    expect(channels[0]?.name).toBe('TEST-V16');
    expect(channels[0]?.power).toBe(25);
    expect(channels[0]?.forbidTransmit).toBe('forbid');
    expect(channels[0]?.rxFrequency).toBe(channels[0]?.txFrequency);
    expect(channels[0]?.modeProfiles[0]).toMatchObject({ bandwidthKHz: 25 });
  });
});

describe('classifyChannelSetDedup', () => {
  it('skips channels with matching RX Hz', () => {
    const fromSet = generateChannelsFromSet(PROJECT_ID, 'uk-vhf-simplex-v').slice(0, 2);
    const existing = [
      {
        ...newChannel(PROJECT_ID, 'Existing'),
        rxFrequency: fromSet[0]?.rxFrequency ?? null,
        txFrequency: fromSet[0]?.txFrequency ?? null,
      },
    ];
    const result = classifyChannelSetDedup(existing, fromSet);
    expect(result.skippedByRxHz).toHaveLength(1);
    expect(result.toAdd).toHaveLength(1);
  });

  it('skips channels with matching name', () => {
    const generated = generateChannelsFromSet(PROJECT_ID, 'pmr446').slice(0, 1);
    const existing = [
      {
        ...newChannel(PROJECT_ID, 'PMR446-1'),
        rxFrequency: 430_000_000,
        txFrequency: 430_000_000,
      },
    ];
    const result = classifyChannelSetDedup(existing, generated);
    expect(result.skippedByName).toHaveLength(1);
    expect(result.toAdd).toHaveLength(0);
  });
});
