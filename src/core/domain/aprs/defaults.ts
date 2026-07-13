import type { AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPositionSource } from '@core/models/libraryTypes.ts';

export const CHANNEL_APRS_OFF: ChannelAprsBinding = {
  receiveEnabled: false,
  reportType: 'off',
  digitalPttMode: 'off',
  reportSlotIndex: null,
};

export function defaultAprsConfigurationFields(): Pick<
  AprsConfiguration,
  | 'manualTxIntervalSec'
  | 'autoTxIntervalSec'
  | 'positionSource'
  | 'fixedLocation'
  | 'channelSlots'
  | 'comment'
> {
  return {
    comment: '',
    manualTxIntervalSec: null,
    autoTxIntervalSec: null,
    positionSource: 'gps' satisfies AprsPositionSource,
    fixedLocation: null,
    channelSlots: [],
  };
}
