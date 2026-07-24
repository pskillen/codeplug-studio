import type { ChannelTone } from '@core/models/libraryTypes.ts';

/** Format repeater / numeric CTCSS Hz as a library tone string (one decimal when whole). */
export function formatCtcssHz(hz: number): ChannelTone {
  if (!Number.isFinite(hz) || hz <= 0) return 'none';
  const oneDecimal = Math.round(hz * 10) / 10;
  const str = oneDecimal.toString();
  return str.includes('.') ? str : `${str}.0`;
}
