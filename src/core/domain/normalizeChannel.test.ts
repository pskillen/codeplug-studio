import { describe, expect, it } from 'vitest';
import { newChannel } from './factories.ts';
import { normalizeChannel } from './normalizeChannel.ts';
import { defaultModeProfile } from './modeProfiles.ts';

describe('normalizeChannel', () => {
  it('defaults missing primaryMode to null', () => {
    const channel = newChannel('proj', 'Test');
    const { primaryMode: _omit, ...withoutPrimary } = channel;
    void _omit;
    const normalized = normalizeChannel(withoutPrimary);
    expect(normalized.primaryMode).toBeNull();
  });

  it('preserves valid primaryMode', () => {
    const channel = {
      ...newChannel('proj', 'Test'),
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'dmr' as const,
    };
    expect(normalizeChannel(channel).primaryMode).toBe('dmr');
  });

  it('clears invalid primaryMode wire values', () => {
    const channel = {
      ...newChannel('proj', 'Test'),
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'not-a-mode' as never,
    };
    expect(normalizeChannel(channel).primaryMode).toBeNull();
  });
});
