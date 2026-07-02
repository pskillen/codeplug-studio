import { describe, expect, it } from 'vitest';
import { emptyLibrary, newChannel, newRxGroupList, newTalkGroup } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import {
  canUpdateLinkedRxGroupList,
  shouldOfferRxGroupListSync,
} from './brandmeisterRxGroupListSync.ts';

describe('brandmeisterRxGroupListSync helpers', () => {
  it('detects shared RX group lists', () => {
    const library = emptyLibrary();
    const list = newRxGroupList('p', 'Shared');
    const tg = newTalkGroup('p', 'Scotland', 2355);
    library.rxGroupLists.push({
      ...list,
      members: [{ ref: { kind: 'talkGroup', id: tg.id } }],
    });
    library.talkGroups.push(tg);

    const dmr: ChannelModeProfileDMR = {
      ...defaultModeProfile('dmr'),
      rxGroupListId: list.id,
    } as ChannelModeProfileDMR;
    const ch1 = { ...newChannel('p', 'A'), modeProfiles: [dmr] };
    const ch2 = { ...newChannel('p', 'B'), modeProfiles: [{ ...dmr }] };
    library.channels.push(ch1, ch2);

    const { canUpdate, sharedCount } = canUpdateLinkedRxGroupList(ch1, library);
    expect(canUpdate).toBe(false);
    expect(sharedCount).toBe(1);
  });

  it('offers sync when remote talk groups differ', () => {
    const library = emptyLibrary();
    const tg = newTalkGroup('p', 'Scotland West', 23559);
    library.talkGroups.push(tg);
    const list = {
      ...newRxGroupList('p', 'GB7AC — BrandMeister'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 2 }],
    };
    library.rxGroupLists.push(list);
    const dmr: ChannelModeProfileDMR = {
      ...defaultModeProfile('dmr'),
      rxGroupListId: list.id,
    } as ChannelModeProfileDMR;
    const channel = { ...newChannel('p', 'GB7AC'), modeProfiles: [dmr] };

    const offer = shouldOfferRxGroupListSync(
      channel,
      [{ digitalId: 23559, name: 'Scotland West', slot: 1 }],
      library,
    );
    expect(offer).toBe(true);
  });
});
