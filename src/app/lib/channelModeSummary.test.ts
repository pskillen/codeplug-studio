import { describe, expect, it } from 'vitest';
import {
  channelModeSummaries,
  channelModeSummaryText,
  modeProfileSummary,
} from './channelModeSummary.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import {
  emptyLibrary,
  newChannel,
  newDigitalContact,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { ChannelModeProfile } from '@core/models/library.ts';

const projectId = 'test-project';
const lookup = {
  ...emptyLibrary(),
  talkGroups: [newTalkGroup(projectId, 'Scotland', 2351, 'dmr')],
  digitalContacts: [newDigitalContact(projectId, 'Dave', 1234567, 'dmr')],
};
const tgId = lookup.talkGroups[0]!.id;
const pcId = lookup.digitalContacts[0]!.id;

describe('modeProfileSummary', () => {
  it('summarises FM tones when only TX is set', () => {
    const profile = {
      ...defaultModeProfile('fm'),
      rxTone: 'none' as const,
      txTone: '94.8' as const,
    };
    expect(modeProfileSummary(profile, lookup)).toBe('T 94.8');
  });

  it('summarises equal TX/RX tones as T/R', () => {
    const profile = {
      ...defaultModeProfile('fm'),
      rxTone: '103.5' as const,
      txTone: '103.5' as const,
      bandwidthKHz: 12.5,
    };
    expect(modeProfileSummary(profile, lookup)).toBe('T/R 103.5 12.5k');
  });

  it('summarises different tones and DCS', () => {
    const profile = {
      ...defaultModeProfile('fm'),
      rxTone: '71.9' as const,
      txTone: 'D023N' as const,
    };
    expect(modeProfileSummary(profile, lookup)).toBe('T D023N R 71.9');
  });

  it('returns empty for a bare stub profile', () => {
    expect(modeProfileSummary(defaultModeProfile('p25'), lookup)).toBe('');
  });

  it('summarises DMR colour code, timeslot and talk group', () => {
    const profile = {
      ...defaultModeProfile('dmr'),
      colourCode: 1,
      timeslot: 2 as const,
      contactRef: { kind: 'talkGroup' as const, id: tgId },
    };
    expect(modeProfileSummary(profile, lookup)).toBe('CC1 TS2 TG2351');
  });

  it('summarises DMR private contact as PC', () => {
    const profile = {
      ...defaultModeProfile('dmr'),
      contactRef: { kind: 'digitalContact' as const, id: pcId },
    };
    expect(modeProfileSummary(profile, lookup)).toBe('PC1234567');
  });

  it('omits unresolved DMR contact ref', () => {
    const profile = {
      ...defaultModeProfile('dmr'),
      colourCode: 1,
      contactRef: { kind: 'talkGroup' as const, id: 'missing' },
    };
    expect(modeProfileSummary(profile, lookup)).toBe('CC1');
  });

  it('summarises NXDN split RAN and rate', () => {
    const profile = {
      ...defaultModeProfile('nxdn'),
      rxRan: 1,
      txRan: 2,
      nxdnRate: 'nxdn96' as const,
    };
    expect(modeProfileSummary(profile, lookup)).toBe('RAN1/2 NXDN96');
  });

  it('summarises NXDN talk group', () => {
    const profile = {
      ...defaultModeProfile('nxdn'),
      rxRan: 1,
      contactRef: { kind: 'talkGroup' as const, id: tgId },
    };
    expect(modeProfileSummary(profile, lookup)).toBe('RAN1 TG2351');
  });

  it('summarises D-STAR UR and RPT1', () => {
    const profile = {
      ...defaultModeProfile('dstar'),
      urCall: 'CQCQCQ',
      rpt1Call: 'GB7XX B',
    };
    expect(modeProfileSummary(profile, lookup)).toBe('→ CQCQCQ via GB7XX B');
  });

  it('summarises SSB sideband', () => {
    expect(modeProfileSummary({ ...defaultModeProfile('ssb'), ssbSideband: 'lsb' }, lookup)).toBe(
      'LSB',
    );
  });

  it('summarises YSF DG-ID', () => {
    expect(modeProfileSummary({ ...defaultModeProfile('ysf'), dgId: 12 }, lookup)).toBe('DG12');
  });

  it('summarises Tetra PLMN and talk group', () => {
    const profile = {
      ...defaultModeProfile('tetra'),
      mcc: 234,
      mnc: 1,
      talkGroupRef: { kind: 'talkGroup' as const, id: tgId },
    };
    expect(modeProfileSummary(profile, lookup)).toBe('234-1 TG2351');
  });

  it('falls back to Tetra GSSI when talk group does not resolve', () => {
    const profile = {
      ...defaultModeProfile('tetra'),
      mcc: 234,
      mnc: 1,
      gssi: 9,
      talkGroupRef: null,
    };
    expect(modeProfileSummary(profile, lookup)).toBe('234-1 TG9');
  });
});

describe('channelModeSummaries', () => {
  it('orders main mode first when multi-mode', () => {
    const channel = newChannel(projectId, 'Demo');
    channel.primaryMode = 'dmr';
    channel.modeProfiles = [
      defaultModeProfile('fm'),
      {
        ...defaultModeProfile('dmr'),
        colourCode: 1,
        timeslot: 2,
        contactRef: { kind: 'talkGroup', id: tgId },
      } as ChannelModeProfile,
    ];
    const summaries = channelModeSummaries(channel, lookup);
    expect(summaries.map((s) => s.mode)).toEqual(['dmr', 'fm']);
    expect(summaries[0]?.isMain).toBe(true);
    expect(summaries[1]?.isMain).toBe(false);
  });

  it('keeps profile order when main mode is second in profiles', () => {
    const channel = newChannel(projectId, 'Demo');
    channel.primaryMode = 'dmr';
    channel.modeProfiles = [
      defaultModeProfile('fm'),
      { ...defaultModeProfile('dmr'), colourCode: 1 } as ChannelModeProfile,
    ];
    const summaries = channelModeSummaries(channel, lookup);
    expect(summaries[0]?.mode).toBe('dmr');
    expect(summaries[1]?.mode).toBe('fm');
  });

  it('does not mark isMain with a single mode', () => {
    const channel = newChannel(projectId, 'Demo');
    channel.modeProfiles = [defaultModeProfile('fm')];
    expect(channelModeSummaries(channel, lookup)[0]?.isMain).toBe(false);
  });

  it('returns none for channels without profiles', () => {
    expect(channelModeSummaries(newChannel(projectId, 'Bare'), lookup)).toEqual([]);
  });
});

describe('channelModeSummaryText', () => {
  it('joins label and detail', () => {
    const channel = newChannel(projectId, 'Demo');
    channel.modeProfiles = [
      {
        ...defaultModeProfile('dmr'),
        colourCode: 1,
        timeslot: 2,
        contactRef: { kind: 'talkGroup', id: tgId },
      },
      { ...defaultModeProfile('fm'), rxTone: 'none', txTone: '103.5' },
    ];
    expect(channelModeSummaryText(channel, lookup)).toBe('DMR CC1 TS2 TG2351 · FM T 103.5');
  });
});

describe('vendor neutrality', () => {
  const profiles: ChannelModeProfile[] = [
    defaultModeProfile('fm'),
    defaultModeProfile('dmr'),
    defaultModeProfile('dstar'),
  ];
  const channel = newChannel(projectId, 'Vendor check');
  channel.modeProfiles = profiles;

  it('never mentions vendor or CPS names in summaries', () => {
    for (const profile of profiles) {
      expect(modeProfileSummary(profile, lookup)).not.toMatch(
        /Anytone|DM-?32|OpenGD77|RadioFoundry|CPS/i,
      );
    }
    expect(channelModeSummaryText(channel, lookup)).not.toMatch(
      /Anytone|DM-?32|OpenGD77|RadioFoundry|CPS/i,
    );
  });
});
