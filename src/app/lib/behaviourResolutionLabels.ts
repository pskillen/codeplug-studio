import type { BehaviourResolutionLayer } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import type { ZoneBehaviourResolutionLayer } from '@core/import-export/zoneBehaviourDefaults/resolve.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import type { EffectiveIncludeInZoneDerivedScanList } from '@core/models/zoneBehaviourDefaults.ts';
import type { WireNameRemediation } from '@core/services/resolveWireNamesCore.ts';

export function layerLabel(layer: BehaviourResolutionLayer): string {
  switch (layer) {
    case 'library':
      return 'Library default';
    case 'channel':
      return 'Channel override';
    case 'build':
      return 'Build override';
  }
}

export function zoneLayerLabel(layer: ZoneBehaviourResolutionLayer): string {
  switch (layer) {
    case 'library':
      return 'Library default';
    case 'member':
      return 'Member override';
    case 'build':
      return 'Build override';
    case 'projection':
      return 'Zone projection';
  }
}

export function forbidTransmitLabel(value: EffectiveForbidTransmit): string {
  return value === 'forbid' ? 'RX only' : 'Allow TX';
}

export function txPermitLabel(value: TxPermitMode): string {
  return value === 'busyLock' ? 'Busy lock' : 'Permit always';
}

export function sendTalkerAliasLabel(value: SendTalkerAliasMode): string {
  return value === 'on' ? 'On' : 'Off';
}

export function analogSquelchModeLabel(value: AnalogSquelchMode): string {
  return value === 'tone' ? 'Tone' : 'Carrier';
}

export function zoneDerivedScanIncludeLabel(value: EffectiveIncludeInZoneDerivedScanList): string {
  return value === 'include' ? 'Include' : 'Skip';
}

/**
 * Wire-name layer attribution for the Resolution view (ux-proposal.md §1) — derived from
 * `WireNameResolution`/`WirePreviewRow` fields, not a fifth stored layer. Four-layer cascade:
 * library → build settings → per-row override → target constraint. `override` set wins
 * outright; otherwise a non-`'none'` remediation means the profile's naming constraint
 * (length limit or dedupe) changed the composed name; absent both, the value is exactly what
 * library data + build naming settings composed.
 */
export type WireNameResolutionLayer = 'override' | 'constraint' | 'settings';

export function wireNameResolutionLayer(row: {
  hasWireNameOverride: boolean;
  remediation?: WireNameRemediation;
}): WireNameResolutionLayer {
  if (row.hasWireNameOverride) return 'override';
  if (row.remediation && row.remediation !== 'none') return 'constraint';
  return 'settings';
}

export function wireNameLayerLabel(layer: WireNameResolutionLayer): string {
  switch (layer) {
    case 'override':
      return 'Row override';
    case 'constraint':
      return 'Target constraint';
    case 'settings':
      return 'Library + build settings';
  }
}
