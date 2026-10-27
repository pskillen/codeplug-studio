import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
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
    const channel: Channel = {
      ...newChannel('proj', 'Test'),
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'dmr' as const,
    };
    expect(normalizeChannel(channel).primaryMode).toBe('dmr');
  });

  it('clears invalid primaryMode wire values', () => {
    const channel: Channel = {
      ...newChannel('proj', 'Test'),
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'not-a-mode' as never,
    };
    expect(normalizeChannel(channel).primaryMode).toBeNull();
  });

  it('moves a stored NXDN talkGroupRef to contactRef (IndexedDB rows go through here)', () => {
    const channel = {
      ...newChannel('proj', 'Test'),
      modeProfiles: [
        {
          mode: 'nxdn',
          rxRan: 1,
          txRan: 1,
          unitId: 5,
          talkGroupRef: { kind: 'talkGroup', id: 'tg-1' },
        },
      ],
    } as unknown as Channel;
    expect(normalizeChannel(channel).modeProfiles[0]).toEqual({
      mode: 'nxdn',
      rxRan: 1,
      txRan: 1,
      unitId: 5,
      ownDigitalIdId: null,
      contactRef: { kind: 'talkGroup', id: 'tg-1' },
      rxGroupListId: null,
      nxdnRate: null,
    });
  });
});
