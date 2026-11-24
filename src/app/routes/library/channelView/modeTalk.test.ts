import { describe, expect, it } from 'vitest';
import {
  emptyLibrary,
  newChannel,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { modeTalk } from './modeTalk.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function sentenceText(parts: { text: string; strong?: boolean }[]): string {
  return parts.map((p) => p.text).join('');
}

function strongTexts(parts: { text: string; strong?: boolean }[]): string[] {
  return parts.filter((p) => p.strong).map((p) => p.text);
}

describe('modeTalk', () => {
  const library = emptyLibrary();
  const tgScotland = newTalkGroup(projectId, 'Scotland', 2351);
  const contactJo = newDigitalContact(projectId, 'Jo Bloggs', 2350123);
  const rxList = newRxGroupList(projectId, 'BrandMeister NI');
  library.talkGroups.push(tgScotland);
  library.digitalContacts.push(contactJo);
  library.rxGroupLists.push(rxList);

  it('FM repeater with matching CTCSS tones', () => {
    const channel = {
      ...newChannel(projectId, 'Test'),
      rxFrequency: 439_550_000,
      txFrequency: 430_550_000,
    };
    const talk = modeTalk(
      { mode: 'fm', rxTone: '94.8', txTone: '94.8', squelch: null, bandwidthKHz: null },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe(
      'Send a 94.8 Hz tone to open the repeater. It sends the same tone back.',
    );
    expect(strongTexts(talk.sentence)).toEqual(['94.8 Hz']);
    expect(talk.facts.map((f) => f.key)).toEqual([]);
    expect(talk.empty).toBe(false);
  });

  it('FM repeater with DCS TX and different RX', () => {
    const channel = {
      ...newChannel(projectId, 'Test'),
      rxFrequency: 145_600_000,
      txFrequency: 145_000_000,
    };
    const talk = modeTalk(
      { mode: 'fm', rxTone: 'D071I', txTone: 'D023N', squelch: null, bandwidthKHz: null },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe(
      'Send DCS code 023N to open the repeater. It sends DCS code 071I back.',
    );
    expect(talk.facts).toEqual([]);
  });

  it('FM repeater without TX tone', () => {
    const channel = {
      ...newChannel(projectId, 'Test'),
      rxFrequency: 439_550_000,
      txFrequency: 430_550_000,
    };
    const talk = modeTalk(
      { mode: 'fm', rxTone: '103.5', txTone: 'none', squelch: null, bandwidthKHz: null },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('No tone needed to open it. It sends 103.5 Hz back.');
    expect(talk.facts.map((f) => f.key)).toEqual([]);
  });

  it('FM simplex with TX tone', () => {
    const channel = {
      ...newChannel(projectId, 'Test'),
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    const talk = modeTalk(
      { mode: 'fm', rxTone: 'none', txTone: '94.8', squelch: null, bandwidthKHz: null },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Talk direct on this frequency. Use a 94.8 Hz tone.');
  });

  it('FM simplex DCS', () => {
    const channel = {
      ...newChannel(projectId, 'Test'),
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    const talk = modeTalk(
      { mode: 'fm', rxTone: 'none', txTone: 'D023N', squelch: null, bandwidthKHz: null },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Talk direct on this frequency. Use DCS code 023N.');
  });

  it('FM receive only', () => {
    const channel = {
      ...newChannel(projectId, 'Test'),
      rxFrequency: 145_500_000,
      txFrequency: null,
    };
    const talk = modeTalk(
      { mode: 'fm', rxTone: '110.9', txTone: '110.9', squelch: null, bandwidthKHz: 12.5 },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Receive only.');
    expect(talk.facts.map((f) => f.key).sort()).toEqual(['bandwidth', 'tone']);
  });

  it('SSB upper sideband', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'ssb',
        rxTone: 'none',
        txTone: 'none',
        squelch: null,
        bandwidthKHz: null,
        ssbSideband: 'usb',
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Upper sideband.');
    expect(talk.facts.map((f) => f.key)).toEqual([]);
  });

  it('DMR talk group channel', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        ownDigitalIdId: null,
        contactRef: { kind: 'talkGroup', id: tgScotland.id },
        rxGroupListId: null,
        dmrMode: 'repeater',
        sendTalkerAliasOverride: 'on',
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe(
      'Talk on TG 2351 Scotland, timeslot 2, colour code 1.',
    );
    expect(talk.facts.map((f) => f.key).sort()).toEqual(['dmrMode', 'talkerAlias']);
  });

  it('DMR private contact', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        ownDigitalIdId: null,
        contactRef: { kind: 'digitalContact', id: contactJo.id },
        rxGroupListId: null,
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe(
      'Call Jo Bloggs (2350123) directly, timeslot 2, colour code 1.',
    );
  });

  it('DMR with no contact but RX list only', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'dmr',
        colourCode: null,
        timeslot: null,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: rxList.id,
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Listens to BrandMeister NI.');
    expect(talk.empty).toBe(false);
  });

  it('DMR timeslot and colour only', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: rxList.id,
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe(
      'Timeslot 2, colour code 1. Listens to BrandMeister NI.',
    );
  });

  it('NXDN talk group with equal RAN', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'nxdn',
        rxRan: 1,
        txRan: 1,
        ownDigitalIdId: null,
        contactRef: { kind: 'talkGroup', id: tgScotland.id },
        rxGroupListId: null,
        nxdnRate: 'nxdn96',
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Talk on TG 2351 Scotland, RAN 1.');
    expect(talk.facts.map((f) => f.key)).toEqual(['rate']);
  });

  it('NXDN split RAN without contact', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'nxdn',
        rxRan: 1,
        txRan: 2,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('RAN 1, sending RAN 2.');
  });

  it('D-STAR with UR and RPT1', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      { mode: 'dstar', urCall: 'CQCQCQ', rpt1Call: 'GB7XX B', rpt2Call: '' },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Call CQCQCQ through GB7XX B.');
    expect(talk.facts.map((f) => f.key)).toEqual([]);
  });

  it('D-STAR UR only', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      { mode: 'dstar', urCall: 'CQCQCQ', rpt1Call: '', rpt2Call: '' },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Call CQCQCQ.');
  });

  it('YSF DG-ID', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk({ mode: 'ysf', dgId: 12, wiresDtmfId: '' }, channel, library);
    expect(sentenceText(talk.sentence)).toBe('Use DG-ID 12.');
    expect(talk.facts.map((f) => f.key)).toEqual([]);
  });

  it('Tetra talk group and network', () => {
    const channel = newChannel(projectId, 'Test');
    const tg9 = newTalkGroup(projectId, 'Local', 9, 'tetra');
    library.talkGroups.push(tg9);
    const talk = modeTalk(
      {
        mode: 'tetra',
        mcc: 234,
        mnc: 1,
        gssi: 9,
        colorCode: 1,
        talkGroupRef: { kind: 'talkGroup', id: tg9.id },
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Talk on TG 9 Local, network 234-1.');
    expect(talk.facts.map((f) => f.key).sort()).toEqual(['colourCode', 'gssi']);
  });

  it('Tetra gssi only', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'tetra',
        mcc: null,
        mnc: null,
        gssi: 12345,
        colorCode: null,
        talkGroupRef: null,
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Talk on TG 12345.');
  });

  it('P25 and M17 placeholder copy', () => {
    const channel = newChannel(projectId, 'Test');
    expect(sentenceText(modeTalk({ mode: 'p25' }, channel, library).sentence)).toBe(
      "Studio doesn't hold P25 settings yet.",
    );
    expect(sentenceText(modeTalk({ mode: 'm17' }, channel, library).sentence)).toBe(
      "Studio doesn't hold M17 settings yet.",
    );
  });

  it('nothing set on DMR', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'dmr',
        colourCode: null,
        timeslot: null,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('No DMR settings yet.');
    expect(talk.empty).toBe(true);
  });

  it('drops unresolved contact refs from the sentence', () => {
    const channel = newChannel(projectId, 'Test');
    const talk = modeTalk(
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        ownDigitalIdId: null,
        contactRef: { kind: 'talkGroup', id: 'missing-id' },
        rxGroupListId: null,
      },
      channel,
      library,
    );
    expect(sentenceText(talk.sentence)).toBe('Timeslot 2, colour code 1.');
  });

  it('sentence copy never names vendors or CPS tools', () => {
    const channel = {
      ...newChannel(projectId, 'Test'),
      rxFrequency: 439_550_000,
      txFrequency: 430_550_000,
    };
    const modes = [
      {
        mode: 'fm' as const,
        rxTone: '94.8' as const,
        txTone: '94.8' as const,
        squelch: null,
        bandwidthKHz: null,
      },
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 2,
        ownDigitalIdId: null,
        contactRef: { kind: 'talkGroup' as const, id: tgScotland.id },
        rxGroupListId: rxList.id,
      },
      { mode: 'dstar' as const, urCall: 'CQCQCQ', rpt1Call: 'GB7XX', rpt2Call: '' },
      { mode: 'p25' as const },
    ];
    const blob = modes.map((p) => sentenceText(modeTalk(p, channel, library).sentence)).join('\n');
    expect(blob).not.toMatch(/Anytone|DM-?32|OpenGD77|RadioFoundry|\bcps\b/i);
  });
});
