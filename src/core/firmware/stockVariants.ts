/**
 * A radio's stock descriptor names one primary stock version and may accept more (`alsoAccepts`). These helpers give
 * generic code one way to see them: a list of single-version descriptors.
 */
import type { StockFirmwareDescriptor } from './types.ts';

/** The descriptor itself, then one single-version descriptor per `alsoAccepts` entry (no `alsoAccepts` of its own). */
export function stockVariants(d: StockFirmwareDescriptor): readonly StockFirmwareDescriptor[] {
  const { alsoAccepts, ...primary } = d;
  return [
    primary,
    ...(alsoAccepts ?? []).map((v) => ({ ...primary, version: v.version, members: v.members })),
  ];
}

/** The single-version descriptor for `version`, or undefined. */
export function stockVariantFor(
  d: StockFirmwareDescriptor,
  version: string,
): StockFirmwareDescriptor | undefined {
  return stockVariants(d).find((v) => v.version === version);
}
