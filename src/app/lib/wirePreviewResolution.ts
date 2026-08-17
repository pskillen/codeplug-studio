/**
 * Per-row "why is it this?" resolution — the row-editor reading absorbed from the deleted
 * `/builds/:id/export-resolution` About route (ux-proposal.md §1). Reuses the existing
 * `resolve*WithLayer` cascades unchanged; wire-name layer attribution derives from
 * `WirePreviewRow` fields via `wireNameResolutionLayer` — see behaviourResolutionLabels.ts.
 *
 * Kept in `app/lib/` (not `core/`) because it only composes core resolvers for a UI read —
 * no domain logic of its own.
 */
import {
  buildChannelBehaviourContext,
  resolveAnalogSquelchModeWithLayer,
  resolveForbidTransmitWithLayer,
  resolveSendTalkerAliasWithLayer,
  resolveTxPermitWithLayer,
} from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import {
  buildZoneBehaviourContext,
  resolveIncludeInZoneDerivedScanListWithLayer,
} from '@core/import-export/zoneBehaviourDefaults/resolve.ts';
import {
  collectZoneScanMemberRefs,
  layoutEntry,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import { findAnalogProfile, findDmrProfile } from '@core/domain/modeProfiles.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import {
  analogSquelchModeLabel,
  forbidTransmitLabel,
  layerLabel,
  sendTalkerAliasLabel,
  txPermitLabel,
  wireNameLayerLabel,
  wireNameResolutionLayer,
  zoneDerivedScanIncludeLabel,
  zoneLayerLabel,
} from './behaviourResolutionLabels.ts';

/** One rendered field in a row's Resolution section/column. */
export interface ResolutionFieldRow {
  key: string;
  label: string;
  value: string;
  layer: string;
}

type WireNameRowSource = Pick<
  WirePreviewRow,
  'hasWireNameOverride' | 'remediation' | 'effectiveWireName'
>;

function wireNameResolutionRow(row: WireNameRowSource): ResolutionFieldRow {
  return {
    key: 'wireName',
    label: 'Wire name',
    value: row.effectiveWireName,
    layer: wireNameLayerLabel(wireNameResolutionLayer(row)),
  };
}

/**
 * Channel Resolution rows: wire name, transmit, TX permit, talker alias (DMR profiles only),
 * analog squelch (analog profiles only) — mirrors the deleted About page's Channels tab.
 */
export function channelWireResolutionRows(
  channel: Channel,
  row: WireNameRowSource,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'channelDefaults'>,
): ResolutionFieldRow[] {
  const context = buildChannelBehaviourContext(library.channelDefaults, build.exportSettings);
  const forbid = resolveForbidTransmitWithLayer(channel, context);
  const txPermit = resolveTxPermitWithLayer(channel, context);
  const dmr = findDmrProfile(channel);
  const analog = findAnalogProfile(channel);

  const rows: ResolutionFieldRow[] = [
    wireNameResolutionRow(row),
    {
      key: 'transmit',
      label: 'Transmit',
      value: forbidTransmitLabel(forbid.value),
      layer: layerLabel(forbid.layer),
    },
    {
      key: 'txPermit',
      label: 'TX permit',
      value: txPermitLabel(txPermit.value),
      layer: layerLabel(txPermit.layer),
    },
  ];

  if (dmr) {
    const talkerAlias = resolveSendTalkerAliasWithLayer(dmr, context);
    rows.push({
      key: 'talkerAlias',
      label: 'Talker alias (DMR)',
      value: sendTalkerAliasLabel(talkerAlias.value),
      layer: layerLabel(talkerAlias.layer),
    });
  }

  if (analog) {
    const squelch = resolveAnalogSquelchModeWithLayer(analog, context);
    rows.push({
      key: 'squelch',
      label: 'Analog squelch',
      value: analogSquelchModeLabel(squelch.value),
      layer: layerLabel(squelch.layer),
    });
  }

  return rows;
}

/** Zone Resolution rows: wire name only — zone-derived scan membership is a separate list. */
export function zoneWireResolutionRows(row: WireNameRowSource): ResolutionFieldRow[] {
  return [wireNameResolutionRow(row)];
}

/** One member channel's zone-derived scan-list inclusion, for the zone Resolution section. */
export interface ZoneScanMemberResolutionRow {
  key: string;
  channelLabel: string;
  value: string;
  layer: string;
}

/**
 * Zone-derived scan membership for one zone's exported channels — undefined when the trait
 * doesn't apply, this zone isn't set to export as a scan list, or the build has no zone
 * grouping layout yet. Mirrors the deleted About page's Zones tab, scoped to one zone.
 */
export function zoneDerivedScanResolutionRows(
  zone: Zone,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'channels' | 'zones' | 'zoneDefaults'>,
  zoneGroupingLayout: ZoneGroupingLayout | undefined,
): ZoneScanMemberResolutionRow[] | undefined {
  if (!zoneGroupingLayout) return undefined;
  const entry = layoutEntry(zoneGroupingLayout, zone.id);
  if (!entry?.exportScanList) return undefined;

  const zoneContext = buildZoneBehaviourContext(library.zoneDefaults, build.exportSettings);
  const channelById = new Map(library.channels.map((channel) => [channel.id, channel]));
  const refs = collectZoneScanMemberRefs(zone, library.zones, {
    context: zoneContext,
    layoutEntry: entry,
  });

  return refs.map((ref) => {
    const channel = channelById.get(ref.channelId);
    const resolved = resolveIncludeInZoneDerivedScanListWithLayer({
      memberOverride: ref.memberOverride,
      channelId: ref.channelId,
      context: zoneContext,
      projection: entry.scanMemberInclusion,
    });
    return {
      key: `${zone.id}:${ref.channelId}`,
      channelLabel: channel ? channelDisplayLabel(channel) : ref.channelId,
      value: zoneDerivedScanIncludeLabel(resolved.value),
      layer: zoneLayerLabel(resolved.layer),
    };
  });
}
