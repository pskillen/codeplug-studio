import { describe, expect, it } from 'vitest';
import { emptyLibrary } from '@core/domain/factories.ts';
import { fullLibraryAggregate } from '../formats/native-yaml/testFixtures.ts';
import { parseChannelOverrideKey, validateChannelOverrideKey } from './channelOverrideKey.ts';
import { expansionWireKey } from './modeExportSuffix.ts';
import { multiTalkGroupMemberWireKey } from './multiTalkGroup.ts';
import { FIXTURE_CHANNEL_B_ID, FIXTURE_TG_ID } from '../formats/native-yaml/testFixtures.ts';

describe('parseChannelOverrideKey', () => {
  it('parses plain channel ids', () => {
    expect(parseChannelOverrideKey(FIXTURE_CHANNEL_B_ID)).toEqual({
      kind: 'plain',
      channelId: FIXTURE_CHANNEL_B_ID,
    });
  });

  it('parses multi-mode expansion keys', () => {
    const key = expansionWireKey('ch-1', 'dmr');
    expect(parseChannelOverrideKey(key)).toEqual({
      kind: 'expansion',
      channelId: 'ch-1',
      modeSuffix: '-D',
    });
  });

  it('parses multi-talkgroup expansion keys', () => {
    const key = multiTalkGroupMemberWireKey(FIXTURE_CHANNEL_B_ID, 'dmr', {
      kind: 'talkGroup',
      id: FIXTURE_TG_ID,
    });
    expect(parseChannelOverrideKey(key)).toEqual({
      kind: 'multiMember',
      channelId: FIXTURE_CHANNEL_B_ID,
      modeSuffix: '-D',
      memberRef: { kind: 'talkGroup', id: FIXTURE_TG_ID },
    });
  });

  it('rejects malformed keys', () => {
    expect(() => parseChannelOverrideKey('bad:-X')).toThrow(/Invalid channel override key/);
    expect(() => parseChannelOverrideKey('ch-1:-D:badKind:id')).toThrow(
      /Invalid channel override key/,
    );
    expect(() => parseChannelOverrideKey('ch-1:-D:talkGroup')).toThrow(
      /Invalid channel override key/,
    );
  });
});

describe('validateChannelOverrideKey', () => {
  const aggregate = fullLibraryAggregate();
  const library = {
    ...emptyLibrary(),
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: aggregate.scanLists,
    aprsConfiguration: aggregate.aprsConfiguration,
  };

  it('accepts plain and composite keys that resolve', () => {
    validateChannelOverrideKey(FIXTURE_CHANNEL_B_ID, library);
    validateChannelOverrideKey(expansionWireKey(FIXTURE_CHANNEL_B_ID, 'dmr'), library);
    validateChannelOverrideKey(
      multiTalkGroupMemberWireKey(FIXTURE_CHANNEL_B_ID, 'dmr', {
        kind: 'talkGroup',
        id: FIXTURE_TG_ID,
      }),
      library,
    );
  });

  it('rejects missing channel or member refs', () => {
    expect(() =>
      validateChannelOverrideKey('00000000-0000-4000-8000-000000000001', library),
    ).toThrow(/not found in library/);
    expect(() =>
      validateChannelOverrideKey(
        multiTalkGroupMemberWireKey(FIXTURE_CHANNEL_B_ID, 'dmr', {
          kind: 'talkGroup',
          id: '00000000-0000-4000-8000-000000000001',
        }),
        library,
      ),
    ).toThrow(/not found in library/);
  });
});
