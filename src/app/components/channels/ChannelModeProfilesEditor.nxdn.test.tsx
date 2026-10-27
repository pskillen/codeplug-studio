import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelModeProfilesEditor from './ChannelModeProfilesEditor.tsx';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import {
  emptyLibrary,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import {
  nxdnCallFromSelectValue,
  nxdnCallOptions,
  nxdnCallValue,
  nxdnRxGroupListOptions,
} from '../../lib/nxdnProfileFields.ts';
import type { ChannelModeProfileNxdn } from '@core/models/library.ts';

const dmrTg = newTalkGroup('p', 'World', 91, 'dmr');
const nxdnTg = newTalkGroup('p', 'NX Group', 10, 'nxdn');
const nxdnContact = newDigitalContact('p', 'NX Bob', 12, 'nxdn');
const dmrContact = newDigitalContact('p', 'DMR Bob', 99, 'dmr');
const nxdnList = {
  ...newRxGroupList('p', 'NX only'),
  members: [{ ref: { kind: 'talkGroup' as const, id: nxdnTg.id } }],
};
const mixedList = {
  ...newRxGroupList('p', 'Mixed'),
  members: [
    { ref: { kind: 'talkGroup' as const, id: nxdnTg.id } },
    { ref: { kind: 'talkGroup' as const, id: dmrTg.id } },
  ],
};
const library = {
  ...emptyLibrary(),
  talkGroups: [dmrTg, nxdnTg],
  digitalContacts: [nxdnContact, dmrContact],
  rxGroupLists: [nxdnList, mixedList],
};

describe('NXDN call and RX group list options', () => {
  it('lists NXDN talk groups then NXDN contacts only', () => {
    expect(nxdnCallOptions(library).map((o) => o.label)).toEqual([
      'None',
      'NX Group (group)',
      'NX Bob',
    ]);
  });

  it('encodes talk groups with a tg: prefix and contacts bare, and decodes back', () => {
    expect(nxdnCallValue({ kind: 'talkGroup', id: 'a' })).toBe('tg:a');
    expect(nxdnCallValue({ kind: 'digitalContact', id: 'b' })).toBe('b');
    expect(nxdnCallFromSelectValue('tg:a')).toEqual({ kind: 'talkGroup', id: 'a' });
    expect(nxdnCallFromSelectValue('b')).toEqual({ kind: 'digitalContact', id: 'b' });
    expect(nxdnCallFromSelectValue('')).toBeNull();
  });

  it('hides mixed lists unless one is already chosen', () => {
    expect(nxdnRxGroupListOptions(library, null).map((o) => o.label)).toEqual(['None', 'NX only']);
    expect(nxdnRxGroupListOptions(library, mixedList.id).map((o) => o.label)).toEqual([
      'None',
      'NX only',
      'Mixed (mixes modes)',
    ]);
  });
});

describe('ChannelModeProfilesEditor NXDN panel', () => {
  it('shows the chosen NXDN contact as the Call and the rate', () => {
    const profile: ChannelModeProfileNxdn = {
      ...(defaultModeProfile('nxdn') as ChannelModeProfileNxdn),
      contactRef: { kind: 'digitalContact', id: nxdnContact.id },
      nxdnRate: 'nxdn96',
    };
    render(
      <DesignSystemV2Provider>
        <ChannelModeProfilesEditor
          profiles={[profile]}
          library={library}
          rxFrequency={null}
          txFrequency={null}
          onChange={() => {}}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByLabelText('Call', { selector: 'input' })).toHaveValue('NX Bob');
    expect(screen.getByLabelText('Rate', { selector: 'input' })).toHaveValue('NXDN96 (12.5 kHz)');
    expect(screen.getByText('Your NXDN ID on this channel, 1–65519.')).toBeInTheDocument();
  });
});
