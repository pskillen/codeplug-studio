import {
  composeChannelWireName,
  EXPORT_NAME_MODE_OPTIONS,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import { shortenWireName } from './shortenName.ts';

/** Common OpenGD77 LCD wire-name limit — informational preview default. */
export const CHANNEL_WIRE_NAME_PREVIEW_LIMIT = 16;

export interface ChannelWireNamePreviewInput {
  callsign: string;
  name: string;
  abbreviation?: string;
}

export interface ChannelWireNamePreviewExample {
  mode: ChannelExportNameMode;
  label: string;
  composed: string;
  /** Result after abbreviation-first shortening to `maxLen`. */
  limited: string;
}

export function channelWireNamePreviewExamples(
  input: ChannelWireNamePreviewInput,
  maxLen = CHANNEL_WIRE_NAME_PREVIEW_LIMIT,
): ChannelWireNamePreviewExample[] {
  const callsign = input.callsign.trim();
  const name = input.name.trim();
  const abbrev = input.abbreviation?.trim();

  return EXPORT_NAME_MODE_OPTIONS.map(({ value, label }) => {
    const pick = { callsign, name, exportNameMode: value };
    const composed = composeChannelWireName(pick);
    const limited = shortenWireName(composed, maxLen, {
      exportNameMode: value,
      recomposeWithMode: (mode) => composeChannelWireName({ callsign, name, exportNameMode: mode }),
      recomposeWithChannelAbbreviation: abbrev
        ? () => composeChannelWireName({ callsign, name: abbrev, exportNameMode: value })
        : undefined,
    });
    return { mode: value, label, composed, limited };
  });
}
