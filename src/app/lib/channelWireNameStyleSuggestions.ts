import type { Channel } from '@core/models/library.ts';
import {
  channelWireNamePreviewExamples,
  CHANNEL_WIRE_NAME_PREVIEW_LIMIT,
} from '@core/import-export/channelExpansion/channelWireNamePreview.ts';
import type { WireNameSuggestion } from '../components/builds/wirePreview/WireNameInlineEditor.tsx';

/**
 * One suggestion per `ChannelExportNameMode` for a channel row's inline editor
 * (ux-proposal.md §6a — the one explicit exception to "one suggestion per identity").
 * Reuses the same per-style composition `ChannelWireNameExamples.tsx` computes on the
 * channel edit page — not a second style-composition path — run through the row's own
 * export name limit when known.
 */
export function channelWireNameStyleSuggestions(
  channel: Pick<Channel, 'callsign' | 'name' | 'abbreviation'>,
  limit?: number,
): WireNameSuggestion[] {
  const examples = channelWireNamePreviewExamples(
    {
      callsign: channel.callsign,
      name: channel.name,
      abbreviation: channel.abbreviation?.trim() || undefined,
    },
    limit ?? CHANNEL_WIRE_NAME_PREVIEW_LIMIT,
  );
  return examples.map((example) => ({ label: example.label, value: example.limited }));
}
