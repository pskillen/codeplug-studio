import type { BehaviourResolutionLayer } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import type { ZoneBehaviourResolutionLayer } from '@core/import-export/zoneBehaviourDefaults/resolve.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import type { EffectiveIncludeInZoneDerivedScanList } from '@core/models/zoneBehaviourDefaults.ts';

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
