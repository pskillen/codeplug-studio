import { describe, expect, it } from 'vitest';
import { newChannel } from '../factories.ts';
import { classifyPublicServiceDedup } from './dedup.ts';
import type { Channel } from '../../models/library.ts';

const PROJECT_ID = 'proj-1';
const PORT_HZ = 156_600_000;

function channel(name: string, rxHz: number, txHz = rxHz): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: rxHz,
    txFrequency: txHz,
    forbidTransmit: 'forbid',
  };
}

describe('classifyPublicServiceDedup', () => {
  it('skips when an existing channel has the same name, ignoring case and surrounding whitespace', () => {
    const generated = [channel('HMCG Ch16', 156_800_000)];
    const existing = [channel('  HMCG CH16  ', 430_000_000)];
    const result = classifyPublicServiceDedup(existing, generated);
    expect(result.toAdd).toHaveLength(0);
    expect(result.skippedByName).toHaveLength(1);
    expect(result.advisories).toHaveLength(0);
  });

  it('adds a frequency collision under a different name and raises an advisory', () => {
    const generated = [channel('Dublin VTS12', PORT_HZ)];
    const existing = [channel('Clyde CG', PORT_HZ)];
    const result = classifyPublicServiceDedup(existing, generated);
    expect(result.toAdd.map((ch) => ch.name)).toEqual(['Dublin VTS12']);
    expect(result.skippedByName).toHaveLength(0);
    expect(result.advisories).toEqual([
      expect.objectContaining({
        existingName: 'Clyde CG',
        rxFrequencyHz: PORT_HZ,
      }),
    ]);
    expect(result.advisories[0]?.channel.name).toBe('Dublin VTS12');
  });

  it('does not let two selected entries suppress each other on a shared RX frequency', () => {
    const generated = [channel('Dublin VTS12', PORT_HZ), channel('Cork Hbr Ch12', PORT_HZ)];
    const result = classifyPublicServiceDedup([], generated);
    expect(result.toAdd.map((ch) => ch.name)).toEqual(['Dublin VTS12', 'Cork Hbr Ch12']);
    expect(result.advisories).toHaveLength(0);
    expect(result.skippedByName).toHaveLength(0);
  });

  it('Dublin/Cork 156.600 MHz: library already has Dublin, Cork still adds with an advisory', () => {
    const generated = [channel('Cork Hbr Ch12', PORT_HZ)];
    const existing = [channel('Dublin VTS12', PORT_HZ)];
    const result = classifyPublicServiceDedup(existing, generated);
    expect(result.toAdd.map((ch) => ch.name)).toEqual(['Cork Hbr Ch12']);
    expect(result.advisories[0]?.existingName).toBe('Dublin VTS12');
    expect(result.advisories[0]?.rxFrequencyHz).toBe(PORT_HZ);
  });

  it('re-running an unchanged selection adds zero channels', () => {
    const generated = [channel('UKFRS FG1', 457_037_500), channel('HMCG Ch16', 156_800_000)];
    const result = classifyPublicServiceDedup(generated, generated);
    expect(result.toAdd).toHaveLength(0);
    expect(result.skippedByName).toHaveLength(2);
  });
});
