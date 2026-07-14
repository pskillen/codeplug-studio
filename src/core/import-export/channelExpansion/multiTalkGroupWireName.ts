import type {
  Channel,
  ChannelModeProfile,
  DigitalContact,
  TalkGroup,
} from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';
import {
  channelPickForWireExport,
  isCallsignToken,
  normalizeCallsignToken,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import {
  entityRefExportLabel,
  findDigitalContactById,
  findTalkGroupById,
} from './entityRefExport.ts';

export type MultiTalkGroupExportNameMode =
  | 'append'
  | 'callsign_name_tg'
  | 'callsign_tg'
  | 'callsign_tg_abbrev'
  | 'suffix_tg_abbrev'
  | 'suffix_tg_number';

export const DEFAULT_MULTI_TG_EXPORT_NAME_MODE: MultiTalkGroupExportNameMode = 'callsign_tg_abbrev';

export interface MultiTalkGroupWireNameContext {
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  useTalkGroupAbbreviation?: boolean;
  nameModeOverride?: ChannelExportNameMode;
  /** Expanded row channel wire name — supplies mode suffix and name-only callsign fallback. */
  siteWireName?: string;
  /** Per RGL member slot hint — used for `Channels.csv` Time Slot, not wire name composition. */
  memberTimeSlotOverride?: DMRTimeSlot | null;
}

function peelModeTag(wire: string): { stem: string; modeTag: '' | '-F' | '-D' } {
  if (wire.endsWith('-F') || wire.endsWith('-D')) {
    return { stem: wire.slice(0, -2), modeTag: wire.slice(-2) as '-F' | '-D' };
  }
  return { stem: wire, modeTag: '' };
}

function effectiveExportCallsign(
  picked: Pick<Channel, 'callsign' | 'name'> & { exportNameMode?: ChannelExportNameMode },
): string {
  const callsign = (picked.callsign ?? '').trim();
  if (callsign) return callsign;
  const name = (picked.name ?? '').trim();
  if (name && isCallsignToken(name)) return normalizeCallsignToken(name);
  return '';
}

function stripDisambiguationSuffix(token: string): string {
  return token.replace(/\s+\d+$/, '');
}

function siteCallsignToken(channel: Channel, ctx: MultiTalkGroupWireNameContext): string {
  const picked = channelPickForWireExport(channel, {
    nameModeOverride: ctx.nameModeOverride,
  });
  const callsign = effectiveExportCallsign(picked);
  if (callsign) {
    const { modeTag } = peelModeTag(ctx.siteWireName ?? '');
    return modeTag ? `${callsign}${modeTag}` : callsign;
  }
  if (ctx.siteWireName) return stripDisambiguationSuffix(peelModeTag(ctx.siteWireName).stem);
  return (picked.name ?? '').trim();
}

function callsignSuffix(callsign: string): string {
  const cs = normalizeCallsignToken(callsign);
  if (!cs) return '';
  return cs.length >= 2 ? cs.slice(-2).toUpperCase() : cs.toUpperCase();
}

function siteCallsignSuffix(channel: Channel, ctx: MultiTalkGroupWireNameContext): string {
  const picked = channelPickForWireExport(channel, {
    nameModeOverride: ctx.nameModeOverride,
  });
  const callsign = effectiveExportCallsign(picked);
  if (!callsign) {
    const abbrev = channel.abbreviation?.trim();
    const name = (picked.name ?? '').trim();
    return callsignSuffix(abbrev || name);
  }
  let token = siteCallsignToken(channel, ctx);
  const { modeTag } = peelModeTag(ctx.siteWireName ?? '');
  if (modeTag && token.endsWith(modeTag)) {
    token = token.slice(0, -modeTag.length);
  }
  return callsignSuffix(stripDisambiguationSuffix(token));
}

function talkGroupNumberToken(tg: TalkGroup): string {
  return String(tg.digitalId);
}

function channelNameQualifier(channel: Channel, ctx: MultiTalkGroupWireNameContext): string {
  const picked = channelPickForWireExport(channel, {
    nameModeOverride: ctx.nameModeOverride,
  });
  return (picked.name ?? '').trim();
}

function memberTgLabel(
  member: EntityRef,
  ctx: MultiTalkGroupWireNameContext,
  preferAbbrev: boolean,
): string | null {
  if (member.kind !== 'talkGroup') {
    return entityRefExportLabel(member, ctx.talkGroups, ctx.digitalContacts, {
      useAbbreviation: false,
    });
  }
  const tg = findTalkGroupById(member.id, ctx.talkGroups);
  if (!tg) return null;
  if (preferAbbrev) {
    const abbrev = tg.abbreviation?.trim();
    if (abbrev) return abbrev;
    if (ctx.useTalkGroupAbbreviation !== false) {
      return entityRefExportLabel(member, ctx.talkGroups, ctx.digitalContacts, {
        useAbbreviation: true,
      });
    }
  }
  return tg.name;
}

function joinParts(...parts: string[]): string {
  return parts.filter((p) => p.length > 0).join(' ');
}

/** Compose a multi-TG expanded row wire name before length trimming. */
export function composeMultiTalkGroupWireName(
  channel: Channel,
  member: EntityRef,
  mode: MultiTalkGroupExportNameMode,
  ctx: MultiTalkGroupWireNameContext,
): string {
  const siteCallsign = siteCallsignToken(channel, ctx);
  const name = channelNameQualifier(channel, ctx);
  const suffix = siteCallsignSuffix(channel, ctx);

  if (member.kind === 'talkGroup') {
    const tg = findTalkGroupById(member.id, ctx.talkGroups);
    if (!tg) return siteCallsign || name;

    switch (mode) {
      case 'callsign_name_tg': {
        const label = memberTgLabel(member, ctx, false);
        return label ? joinParts(siteCallsign, name, label) : joinParts(siteCallsign, name);
      }
      case 'callsign_tg': {
        const label = memberTgLabel(member, ctx, false);
        return label ? joinParts(siteCallsign, label) : siteCallsign || name;
      }
      case 'callsign_tg_abbrev': {
        const label = memberTgLabel(member, ctx, true);
        return label ? joinParts(siteCallsign, label) : joinParts(siteCallsign, name);
      }
      case 'suffix_tg_abbrev': {
        const label = memberTgLabel(member, ctx, true);
        return label ? joinParts(suffix, label) : suffix || name;
      }
      case 'suffix_tg_number': {
        const token = talkGroupNumberToken(tg);
        return token ? joinParts(suffix, token) : joinParts(suffix, tg.name);
      }
      default:
        break;
    }
  }

  const contact =
    member.kind === 'digitalContact'
      ? findDigitalContactById(member.id, ctx.digitalContacts)
      : null;
  const contactLabel =
    contact?.name ?? entityRefExportLabel(member, ctx.talkGroups, ctx.digitalContacts);
  if (mode === 'suffix_tg_number' && contact) {
    const token = String(contact.digitalId);
    return token ? joinParts(suffix, token) : joinParts(suffix, contact.name);
  }
  if (mode === 'callsign_tg' || mode === 'callsign_tg_abbrev') {
    return contactLabel ? joinParts(siteCallsign, contactLabel) : joinParts(siteCallsign, name);
  }
  if (mode === 'suffix_tg_abbrev') {
    return contactLabel ? joinParts(suffix, contactLabel) : joinParts(suffix, name);
  }
  if (mode === 'callsign_name_tg') {
    return contactLabel
      ? joinParts(siteCallsign, name, contactLabel)
      : joinParts(siteCallsign, name);
  }
  return contactLabel ? joinParts(siteCallsign, name, contactLabel) : joinParts(siteCallsign, name);
}

/** Trailing portion of a TG-first composed name that must survive shortening. */
export function multiTalkGroupProtectedSuffix(
  _channel: Channel,
  member: EntityRef,
  mode: MultiTalkGroupExportNameMode,
  ctx: MultiTalkGroupWireNameContext,
): string | undefined {
  if (mode === 'append') return undefined;

  if (member.kind === 'talkGroup') {
    const tg = findTalkGroupById(member.id, ctx.talkGroups);
    if (!tg) return undefined;

    if (mode === 'suffix_tg_number') {
      const token = talkGroupNumberToken(tg);
      return token ? ` ${token}` : ` ${tg.name}`;
    }

    const preferAbbrev = mode === 'callsign_tg_abbrev' || mode === 'suffix_tg_abbrev';
    const label = memberTgLabel(member, ctx, preferAbbrev);
    return label ? ` ${label}` : undefined;
  }

  const contact =
    member.kind === 'digitalContact'
      ? findDigitalContactById(member.id, ctx.digitalContacts)
      : null;
  if (mode === 'suffix_tg_number' && contact) {
    const token = String(contact.digitalId);
    return token ? ` ${token}` : ` ${contact.name}`;
  }
  const contactLabel =
    contact?.name ?? entityRefExportLabel(member, ctx.talkGroups, ctx.digitalContacts);
  return contactLabel ? ` ${contactLabel}` : undefined;
}

/** Escalate to a tighter mode when the composed name still exceeds the budget. */
export function escalateMultiTalkGroupExportNameMode(
  mode: MultiTalkGroupExportNameMode,
): MultiTalkGroupExportNameMode | null {
  switch (mode) {
    case 'callsign_name_tg':
      return 'callsign_tg_abbrev';
    case 'callsign_tg':
      return 'callsign_tg_abbrev';
    case 'callsign_tg_abbrev':
      return 'suffix_tg_abbrev';
    case 'suffix_tg_abbrev':
      return 'suffix_tg_number';
    default:
      return null;
  }
}

export type { ChannelModeProfile };
