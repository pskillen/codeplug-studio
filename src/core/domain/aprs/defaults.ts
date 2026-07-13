import type { AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPositionSource, AprsSlotCallType } from '@core/models/libraryTypes.ts';

export const CHANNEL_APRS_OFF: ChannelAprsBinding = {
  receiveEnabled: false,
  reportType: 'off',
  digitalPttMode: 'off',
  reportChannelRef: null,
};

export function defaultAprsConfigurationFields(): Pick<
  AprsConfiguration,
  | 'manualTxIntervalSec'
  | 'autoTxIntervalSec'
  | 'positionSource'
  | 'fixedLocation'
  | 'channelSlots'
  | 'defaultDmrId'
  | 'defaultCallType'
  | 'comment'
> {
  return {
    comment: '',
    manualTxIntervalSec: null,
    autoTxIntervalSec: null,
    positionSource: 'gps' satisfies AprsPositionSource,
    fixedLocation: null,
    channelSlots: [],
    defaultDmrId: null,
    defaultCallType: 'group' satisfies AprsSlotCallType,
  };
}
