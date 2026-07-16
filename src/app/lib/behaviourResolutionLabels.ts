import type { BehaviourResolutionLayer } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';

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
