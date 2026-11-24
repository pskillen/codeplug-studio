import type {
  Channel,
  ChannelModeProfile,
  ChannelTone,
  EntityRef,
  Library,
} from '@core/models/library.ts';
import { modeLabel } from '../../../lib/channelModes.ts';
import {
  modeProfileFacts,
  modeProfileRxGroupListId,
  type ChannelFact,
} from './modeProfileFacts.ts';

export interface TalkPart {
  text: string;
  strong?: boolean;
}

export interface ModeTalk {
  sentence: TalkPart[];
  facts: ChannelFact[];
  empty: boolean;
}

function toneSet(tone: ChannelTone | undefined): boolean {
  return tone != null && tone !== 'none' && tone.trim() !== '';
}

function parseDcs(tone: string): { code: string; suffix: string } | null {
  const match = /^D(\d{3})([NI])$/i.exec(tone.trim());
  if (!match) return null;
  return { code: match[1]!, suffix: match[2]!.toUpperCase() };
}

/** Bold fragment for a tone value in a sentence (CTCSS Hz or DCS code). */
function toneBoldValue(tone: string): string {
  const dcs = parseDcs(tone);
  if (dcs) return `${dcs.code}${dcs.suffix}`;
  return `${tone} Hz`;
}

function appendTxOpenTone(sentence: TalkPart[], tx: string | null): void {
  if (!tx) {
    sentence.push({ text: 'No tone needed to open it.' });
    return;
  }
  const dcs = parseDcs(tx);
  if (dcs) {
    sentence.push(
      { text: 'Send DCS code ' },
      { text: toneBoldValue(tx), strong: true },
      { text: ' to open the repeater.' },
    );
    return;
  }
  sentence.push(
    { text: 'Send a ' },
    { text: toneBoldValue(tx), strong: true },
    { text: ' tone to open the repeater.' },
  );
}

function appendRxReplyTone(sentence: TalkPart[], rx: string | null, tx: string | null): void {
  if (!rx) {
    sentence.push({ text: ' ' }, { text: "It doesn't send a tone back." });
    return;
  }
  if (tx && rx === tx) {
    sentence.push({ text: ' ' }, { text: 'It sends the same tone back.' });
    return;
  }
  const dcs = parseDcs(rx);
  if (dcs) {
    sentence.push(
      { text: ' ' },
      { text: 'It sends DCS code ' },
      { text: toneBoldValue(rx), strong: true },
      { text: ' back.' },
    );
    return;
  }
  sentence.push(
    { text: ' ' },
    { text: 'It sends ' },
    { text: toneBoldValue(rx), strong: true },
    { text: ' back.' },
  );
}

function appendSimplexTxTone(sentence: TalkPart[], tx: string): void {
  const dcs = parseDcs(tx);
  if (dcs) {
    sentence.push(
      { text: ' ' },
      { text: 'Use DCS code ' },
      { text: toneBoldValue(tx), strong: true },
      { text: '.' },
    );
    return;
  }
  sentence.push(
    { text: ' ' },
    { text: 'Use a ' },
    { text: toneBoldValue(tx), strong: true },
    { text: ' tone.' },
  );
}

function repeaterSplit(channel: Channel): boolean {
  const { rxFrequency: rx, txFrequency: tx } = channel;
  return rx != null && tx != null && tx !== rx;
}

function receiveOnly(channel: Channel): boolean {
  return channel.rxFrequency != null && channel.txFrequency == null;
}

function simplexFrequencies(channel: Channel): boolean {
  const { rxFrequency: rx, txFrequency: tx } = channel;
  return rx != null && tx != null && tx === rx;
}

function talkGroupPhrase(ref: EntityRef, library: Library): TalkPart[] | null {
  if (ref.kind !== 'talkGroup') return null;
  const tg = library.talkGroups.find((row) => row.id === ref.id);
  if (!tg) return null;
  const name = tg.name.trim();
  const bold = name ? `TG ${tg.digitalId} ${name}` : `TG ${tg.digitalId}`;
  return [{ text: bold, strong: true }];
}

function privateContactPhrase(ref: EntityRef, library: Library): TalkPart[] | null {
  if (ref.kind !== 'digitalContact') return null;
  const contact = library.digitalContacts.find((row) => row.id === ref.id);
  if (!contact) return null;
  const name = contact.name.trim() || String(contact.digitalId);
  return [{ text: `${name} (${contact.digitalId})`, strong: true }];
}

function rxListSentence(library: Library, listId: string | null): TalkPart[] {
  if (!listId) return [];
  const list = library.rxGroupLists.find((row) => row.id === listId);
  if (!list?.name.trim()) return [];
  return [
    { text: ' ' },
    { text: 'Listens to ' },
    { text: list.name.trim(), strong: true },
    { text: '.' },
  ];
}

function analogTalk(
  profile: Extract<ChannelModeProfile, { mode: 'fm' | 'am' }>,
  channel: Channel,
): { sentence: TalkPart[]; usedKeys: Set<string> } {
  const sentence: TalkPart[] = [];
  const usedKeys = new Set<string>();
  const rx = toneSet(profile.rxTone) ? profile.rxTone : null;
  const tx = toneSet(profile.txTone) ? profile.txTone : null;

  if (receiveOnly(channel)) {
    sentence.push({ text: 'Receive only.' });
    return { sentence, usedKeys };
  }

  if (simplexFrequencies(channel)) {
    sentence.push({ text: 'Talk direct on this frequency.' });
    if (tx) {
      appendSimplexTxTone(sentence, tx);
      if (rx === tx) usedKeys.add('tone');
      else usedKeys.add('txTone');
    }
    return { sentence, usedKeys };
  }

  if (repeaterSplit(channel)) {
    appendTxOpenTone(sentence, tx);
    appendRxReplyTone(sentence, rx, tx);
    if (rx && tx && rx === tx) {
      usedKeys.add('tone');
    } else {
      if (tx) usedKeys.add('txTone');
      if (rx) usedKeys.add('rxTone');
    }
    return { sentence, usedKeys };
  }

  if (tx || rx) {
    if (rx === tx && tx) {
      appendTxOpenTone(sentence, tx);
      usedKeys.add('tone');
    } else {
      if (tx) {
        appendTxOpenTone(sentence, tx);
        usedKeys.add('txTone');
      }
      if (rx) {
        appendRxReplyTone(sentence, rx, tx);
        usedKeys.add('rxTone');
      }
    }
  }

  return { sentence, usedKeys };
}

function dmrTalk(
  profile: Extract<ChannelModeProfile, { mode: 'dmr' }>,
  library: Library,
): {
  sentence: TalkPart[];
  usedKeys: Set<string>;
} {
  const sentence: TalkPart[] = [];
  const usedKeys = new Set<string>();
  const ref = profile.contactRef;
  let contactParts: TalkPart[] | null = null;
  if (ref?.kind === 'talkGroup') contactParts = talkGroupPhrase(ref, library);
  else if (ref?.kind === 'digitalContact') contactParts = privateContactPhrase(ref, library);

  if (contactParts) {
    if (ref?.kind === 'digitalContact') {
      sentence.push({ text: 'Call ' }, ...contactParts, { text: ' directly' });
    } else {
      sentence.push({ text: 'Talk on ' }, ...contactParts);
    }
    usedKeys.add('talkGroup');
    if (profile.timeslot != null) {
      sentence.push({ text: ', timeslot ' }, { text: String(profile.timeslot), strong: true });
      usedKeys.add('timeslot');
    }
    if (profile.colourCode != null) {
      sentence.push({ text: ', colour code ' }, { text: String(profile.colourCode), strong: true });
      usedKeys.add('colourCode');
    }
    sentence.push({ text: '.' });
  } else {
    const lead: TalkPart[] = [];
    if (profile.timeslot != null) {
      lead.push({ text: 'Timeslot ' }, { text: String(profile.timeslot), strong: true });
      usedKeys.add('timeslot');
    }
    if (profile.colourCode != null) {
      if (lead.length > 0) lead.push({ text: ', colour code ' });
      else lead.push({ text: 'Colour code ' });
      lead.push({ text: String(profile.colourCode), strong: true });
      usedKeys.add('colourCode');
    }
    if (lead.length > 0) {
      sentence.push(...lead, { text: '.' });
    }
  }

  const listParts = rxListSentence(library, profile.rxGroupListId);
  if (listParts.length > 0) {
    if (sentence.length === 0) sentence.push(...listParts.slice(1));
    else sentence.push(...listParts);
  }

  return { sentence, usedKeys };
}

function nxdnTalk(
  profile: Extract<ChannelModeProfile, { mode: 'nxdn' }>,
  library: Library,
): {
  sentence: TalkPart[];
  usedKeys: Set<string>;
} {
  const sentence: TalkPart[] = [];
  const usedKeys = new Set<string>();
  const ref = profile.contactRef;
  let contactParts: TalkPart[] | null = null;
  if (ref?.kind === 'talkGroup') contactParts = talkGroupPhrase(ref, library);
  else if (ref?.kind === 'digitalContact') contactParts = privateContactPhrase(ref, library);

  const rxRan = profile.rxRan;
  const txRan = profile.txRan;
  const ranEqual = rxRan != null && txRan != null && rxRan === txRan;
  const ranValue = ranEqual ? rxRan : (txRan ?? rxRan);

  if (contactParts) {
    if (ref?.kind === 'digitalContact') {
      sentence.push({ text: 'Call ' }, ...contactParts);
      if (ranValue != null) {
        sentence.push({ text: ' directly, RAN ' }, { text: String(ranValue), strong: true });
        if (ranEqual) usedKeys.add('ran');
        else {
          if (txRan != null) usedKeys.add('txRan');
          if (rxRan != null) usedKeys.add('rxRan');
        }
      } else {
        sentence.push({ text: ' directly' });
      }
    } else {
      sentence.push({ text: 'Talk on ' }, ...contactParts);
      if (ranValue != null) {
        sentence.push({ text: ', RAN ' }, { text: String(ranValue), strong: true });
        if (ranEqual) usedKeys.add('ran');
        else {
          if (txRan != null) usedKeys.add('txRan');
          if (rxRan != null && txRan != null && rxRan !== txRan) {
            sentence.push({ text: ', sending RAN ' }, { text: String(txRan), strong: true });
            usedKeys.add('txRan');
            usedKeys.add('rxRan');
          }
        }
      }
    }
    usedKeys.add('talkGroup');
    sentence.push({ text: '.' });
  } else if (ranValue != null) {
    if (rxRan != null && txRan != null && rxRan !== txRan) {
      sentence.push(
        { text: 'RAN ' },
        { text: String(rxRan), strong: true },
        { text: ', sending RAN ' },
        { text: String(txRan), strong: true },
        { text: '.' },
      );
      usedKeys.add('rxRan');
      usedKeys.add('txRan');
    } else {
      sentence.push({ text: 'RAN ' }, { text: String(ranValue), strong: true }, { text: '.' });
      if (ranEqual) usedKeys.add('ran');
      else if (txRan != null) usedKeys.add('txRan');
      else usedKeys.add('rxRan');
    }
  }

  const listParts = rxListSentence(library, profile.rxGroupListId);
  if (listParts.length > 0) {
    if (sentence.length === 0) sentence.push(...listParts.slice(1));
    else sentence.push(...listParts);
  }

  return { sentence, usedKeys };
}

function buildSentence(
  profile: ChannelModeProfile,
  channel: Channel,
  library: Library,
): { sentence: TalkPart[]; usedKeys: Set<string> } {
  switch (profile.mode) {
    case 'fm':
    case 'am':
      return analogTalk(profile, channel);
    case 'ssb': {
      const sentence: TalkPart[] = [];
      const usedKeys = new Set<string>();
      const side = profile.ssbSideband ?? 'usb';
      sentence.push(
        { text: side === 'lsb' ? 'Lower' : 'Upper', strong: true },
        { text: ' sideband.' },
      );
      usedKeys.add('sideband');
      return { sentence, usedKeys };
    }
    case 'dmr':
      return dmrTalk(profile, library);
    case 'nxdn':
      return nxdnTalk(profile, library);
    case 'dstar': {
      const sentence: TalkPart[] = [];
      const usedKeys = new Set<string>();
      const ur = profile.urCall.trim();
      const rpt1 = profile.rpt1Call.trim();
      if (ur) {
        sentence.push({ text: 'Call ' }, { text: ur, strong: true });
        usedKeys.add('ur');
        if (rpt1) {
          sentence.push({ text: ' through ' }, { text: rpt1, strong: true }, { text: '.' });
          usedKeys.add('rpt1');
        } else {
          sentence.push({ text: '.' });
        }
      } else if (rpt1) {
        sentence.push({ text: 'Through ' }, { text: rpt1, strong: true }, { text: '.' });
        usedKeys.add('rpt1');
      }
      return { sentence, usedKeys };
    }
    case 'ysf': {
      const sentence: TalkPart[] = [];
      const usedKeys = new Set<string>();
      if (profile.dgId != null) {
        sentence.push(
          { text: 'Use DG-ID ' },
          { text: String(profile.dgId), strong: true },
          { text: '.' },
        );
        usedKeys.add('dgId');
      }
      return { sentence, usedKeys };
    }
    case 'tetra': {
      const sentence: TalkPart[] = [];
      const usedKeys = new Set<string>();
      const ref = profile.talkGroupRef;
      const tgParts = ref ? talkGroupPhrase(ref, library) : null;
      if (tgParts) {
        sentence.push({ text: 'Talk on ' }, ...tgParts);
        usedKeys.add('talkGroup');
      } else if (profile.gssi != null) {
        sentence.push({ text: 'Talk on TG ' }, { text: String(profile.gssi), strong: true });
        usedKeys.add('gssi');
      }
      if (profile.mcc != null && profile.mnc != null) {
        if (sentence.length > 0) sentence.push({ text: ', network ' });
        else sentence.push({ text: 'Network ' });
        sentence.push({ text: `${profile.mcc}-${profile.mnc}`, strong: true });
        usedKeys.add('mcc');
        usedKeys.add('mnc');
      }
      if (sentence.length > 0) sentence.push({ text: '.' });
      return { sentence, usedKeys };
    }
    case 'p25':
      return {
        sentence: [{ text: "Studio doesn't hold P25 settings yet." }],
        usedKeys: new Set(),
      };
    case 'm17':
      return {
        sentence: [{ text: "Studio doesn't hold M17 settings yet." }],
        usedKeys: new Set(),
      };
    default: {
      const _exhaustive: never = profile;
      return _exhaustive;
    }
  }
}

export function modeTalk(
  profile: ChannelModeProfile,
  channel: Channel,
  library: Library,
): ModeTalk {
  const { sentence, usedKeys } = buildSentence(profile, channel, library);
  const allFacts = modeProfileFacts(profile, library);
  const facts = allFacts.filter((f) => !usedKeys.has(f.key));
  const hasRxList = modeProfileRxGroupListId(profile) != null;

  if (sentence.length === 0) {
    const label = modeLabel(profile.mode);
    if (profile.mode === 'p25' || profile.mode === 'm17') {
      return {
        sentence: [{ text: `Studio doesn't hold ${label} settings yet.` }],
        facts,
        empty: false,
      };
    }
    return {
      sentence: [{ text: `No ${label} settings yet.` }],
      facts,
      empty: !hasRxList,
    };
  }

  return { sentence, facts, empty: false };
}
