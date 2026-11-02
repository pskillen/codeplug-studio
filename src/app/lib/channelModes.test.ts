import { describe, expect, it } from 'vitest';
import {
  getModeDefinition,
  isAnalogMode,
  isDigitalMode,
  modeFilterOptions,
  normalizeChannelMode,
} from './channelModes.ts';

describe('reserved meshtastic colour', () => {
  it('has its own colour, distinct from every other mode', () => {
    const def = getModeDefinition('meshtastic');
    expect(def.category).toBe('mesh');
    expect(def.color).toBe('#82c91e');
    expect(modeFilterOptions().map((o) => getModeDefinition(o.value).color)).not.toContain(
      def.color,
    );
  });

  it('is not offered as a mode filter', () => {
    expect(modeFilterOptions().map((o) => o.value)).not.toContain('meshtastic');
  });

  it('is never accepted as a stored channel mode', () => {
    expect(normalizeChannelMode('meshtastic')).toBe('other');
    expect(normalizeChannelMode('dmr')).toBe('dmr');
  });

  it('is neither analog nor digital', () => {
    expect(isAnalogMode('meshtastic')).toBe(false);
    expect(isDigitalMode('meshtastic')).toBe(false);
  });
});
