/**
 * A radio's stock descriptor names one primary stock version and may accept more (`alsoAccepts`). These helpers give
 * generic code one way to see them: a list of single-version descriptors.
 */
import type { FirmwarePatchDescription } from './patch/types.ts';
import type { StockFirmwareDescriptor } from './types.ts';

/** The descriptor itself, then one single-version descriptor per `alsoAccepts` entry (no `alsoAccepts` of its own). */
export function stockVariants(d: StockFirmwareDescriptor): readonly StockFirmwareDescriptor[] {
  const { alsoAccepts, ...primary } = d;
  return [
    primary,
    ...(alsoAccepts ?? []).map((v) => ({
      ...primary,
      version: v.version,
      baseName: v.baseName,
      members: v.members,
    })),
  ];
}

/** The single-version descriptor for `version`, or undefined. */
export function stockVariantFor(
  d: StockFirmwareDescriptor,
  version: string,
): StockFirmwareDescriptor | undefined {
  return stockVariants(d).find((v) => v.version === version);
}

/**
 * The stock a to-stock patch installs: the variant whose base name is both the patch's `base` and its build name.
 * Undefined for any other patch. Descriptive only: the radio's interlocks decide what is flashed.
 */
export function toStockVariantFor(
  d: StockFirmwareDescriptor,
  description: Pick<FirmwarePatchDescription, 'base' | 'buildName'>,
): StockFirmwareDescriptor | undefined {
  const { base, buildName } = description;
  if (base === undefined || buildName !== base) return undefined;
  return stockVariants(d).find((v) => v.baseName !== undefined && v.baseName === base);
}
