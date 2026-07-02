import { DEFAULT_MULTI_TG_EXPORT_NAME_MODE } from './multiTalkGroupWireName.ts';
import { applyMultiTalkGroupWireNameLimits } from './multiTalkGroup.ts';
import { composeMultiTalkGroupWireName } from './multiTalkGroupWireName.ts';

/** Common OpenGD77 LCD wire-name limit — informational preview default. */
export const TALK_GROUP_WIRE_NAME_PREVIEW_LIMIT = 16;

const PREVIEW_SAMPLE_CALLSIGN = 'GB7GL';
const PREVIEW_SAMPLE_CHANNEL_NAME = 'Glasgow';

export interface TalkGroupWireNamePreviewInput {
  name: string;
  abbreviation?: string;
  digitalId: number;
  /** Sample repeater callsign for composed examples. */
  sampleCallsign?: string;
}

export interface TalkGroupWireNamePreviewExample {
  label: string;
  composed: string;
  limited: string;
}

function previewChannel(callsign: string) {
  return {
    id: 'preview-channel',
    projectId: 'preview',
    revision: 1,
    updatedAt: '',
    name: PREVIEW_SAMPLE_CHANNEL_NAME,
    callsign,
    rxFrequency: null,
    txFrequency: null,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanSkip: false,
    forbidTransmit: false,
    comment: '',
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 2,
        dmrId: null,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
}

function previewTalkGroup(input: TalkGroupWireNamePreviewInput) {
  return {
    id: 'preview-tg',
    projectId: 'preview',
    revision: 1,
    updatedAt: '',
    mode: 'dmr' as const,
    name: input.name.trim() || 'Talk group',
    digitalId: input.digitalId,
    comment: '',
    ...(input.abbreviation?.trim() ? { abbreviation: input.abbreviation.trim() } : {}),
  };
}

export function talkGroupWireNamePreviewExamples(
  input: TalkGroupWireNamePreviewInput,
  maxLen = TALK_GROUP_WIRE_NAME_PREVIEW_LIMIT,
): TalkGroupWireNamePreviewExample[] {
  const callsign = (input.sampleCallsign?.trim() || PREVIEW_SAMPLE_CALLSIGN).trim();
  const channel = previewChannel(callsign);
  const talkGroup = previewTalkGroup(input);
  const member = { kind: 'talkGroup' as const, id: talkGroup.id };
  const library = { talkGroups: [talkGroup], digitalContacts: [] };
  const siteWireName = `${callsign} ${PREVIEW_SAMPLE_CHANNEL_NAME}-D`;
  const ctx = {
    talkGroups: library.talkGroups,
    digitalContacts: library.digitalContacts,
    useTalkGroupAbbreviation: true,
    siteWireName,
    memberTimeSlotOverride: 2 as const,
  };

  const modes: { label: string; mode: typeof DEFAULT_MULTI_TG_EXPORT_NAME_MODE | 'callsign_name_tg' | 'callsign_tg' }[] = [
    { label: 'Callsign + TG abbrev (DM32 default)', mode: 'callsign_tg_abbrev' },
    { label: 'Callsign + TG name', mode: 'callsign_tg' },
    { label: 'Callsign + name + TG', mode: 'callsign_name_tg' },
  ];

  return modes.map(({ label, mode }) => {
    const composed = composeMultiTalkGroupWireName(channel, member, mode, ctx);
    const reserved = new Set<string>();
    const limited = applyMultiTalkGroupWireNameLimits(
      channel,
      member,
      library,
      siteWireName,
      2,
      reserved,
      {
        shortenNames: true,
        maxNameLength: maxLen,
        useTalkGroupAbbreviation: true,
        multiTalkGroupExportNameMode: mode,
      },
      'opengd77-1701',
      [],
    );
    return { label, composed, limited };
  });
}
