export type DebugFirmwareFamily = 'stock' | 'opengd77' | 'radiofoundry';

export const DEBUG_FIRMWARE_ORDER: readonly DebugFirmwareFamily[] = [
  'stock',
  'opengd77',
  'radiofoundry',
];

export const DEBUG_FIRMWARE_LABEL: Record<DebugFirmwareFamily, string> = {
  stock: 'Stock / MM9PDY',
  opengd77: 'OpenGD77',
  radiofoundry: 'RadioFoundry',
};

export function isDebugFirmwareFamily(value: string): value is DebugFirmwareFamily {
  return (DEBUG_FIRMWARE_ORDER as readonly string[]).includes(value);
}
