/**
 * Registry of each supported radio's pinned stock firmware. Imports the radio homes; holds no radio facts itself.
 */
import { AT_D890UV_STOCK_FIRMWARE } from '../radios/anytone/at-d890uv/firmware.ts';
import { DM32UV_STOCK_FIRMWARE } from '../radios/baofeng/dm-32uv/firmware.ts';
import { RT95_HEAD_STOCK_FIRMWARE } from '../radios/retevis/rt95/firmware.ts';
import type { FirmwareRadioId, StockFirmwareDescriptor } from './types.ts';

const STOCK_FIRMWARE: readonly StockFirmwareDescriptor[] = [
  DM32UV_STOCK_FIRMWARE,
  AT_D890UV_STOCK_FIRMWARE,
  RT95_HEAD_STOCK_FIRMWARE,
];

export function listStockFirmwareDescriptors(): readonly StockFirmwareDescriptor[] {
  return STOCK_FIRMWARE;
}

export function getStockFirmwareDescriptor(radioId: FirmwareRadioId): StockFirmwareDescriptor {
  const found = STOCK_FIRMWARE.find((d) => d.radioId === radioId);
  if (!found) throw new Error(`No stock firmware descriptor for ${radioId}`);
  return found;
}
