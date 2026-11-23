import { describe, expect, it } from 'vitest';
import { emptyLibrary, newChannel, newTalkGroup } from '@core/domain/factories.ts';
import { entityRefDisplayName } from './entityRefs.ts';

describe('entityRefDisplayName', () => {
  it('shows callsign and name for a channel ref', () => {
    const channel = { ...newChannel('p1', 'Glasgow', 'GB3AA'), id: 'ch-1' };
    const library = { ...emptyLibrary(), channels: [channel] };
    expect(entityRefDisplayName({ kind: 'channel', id: 'ch-1' }, library)).toBe('GB3AA — Glasgow');
  });

  it('shows name alone for a channel ref without callsign', () => {
    const channel = { ...newChannel('p1', 'Glasgow', ''), id: 'ch-1' };
    const library = { ...emptyLibrary(), channels: [channel] };
    expect(entityRefDisplayName({ kind: 'channel', id: 'ch-1' }, library)).toBe('Glasgow');
  });

  it('returns empty string for a missing channel ref', () => {
    const library = emptyLibrary();
    expect(entityRefDisplayName({ kind: 'channel', id: 'missing' }, library)).toBe('');
  });

  it('returns empty string when the channel has no callsign or name', () => {
    const channel = { ...newChannel('p1', '', ''), id: 'ch-1' };
    const library = { ...emptyLibrary(), channels: [channel] };
    expect(entityRefDisplayName({ kind: 'channel', id: 'ch-1' }, library)).toBe('');
  });

  it('still returns talk group name for non-channel refs', () => {
    const tg = { ...newTalkGroup('p1', 'Region'), id: 'tg-1' };
    const library = { ...emptyLibrary(), talkGroups: [tg] };
    expect(entityRefDisplayName({ kind: 'talkGroup', id: 'tg-1' }, library)).toBe('Region');
  });
});
