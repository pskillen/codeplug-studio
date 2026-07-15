/** Row count at which `virtualize: 'auto'` enables windowed tbody rendering. */
export const VIRTUAL_ROW_THRESHOLD = 75;

export const DEFAULT_LIST_ROW_HEIGHT = 44;
export const DEFAULT_ACTIVATE_ROW_HEIGHT = 56;
/** Extra rows rendered above/below the viewport — higher reduces fast-scroll gaps. */
export const DEFAULT_VIRTUAL_OVERSCAN = 20;

export type DataTableVirtualizeMode = boolean | 'auto';

export function resolveDataTableVirtualization(
  virtualize: DataTableVirtualizeMode | undefined,
  rowCount: number,
): boolean {
  if (virtualize === false) return false;
  if (virtualize === true) return true;
  return rowCount >= VIRTUAL_ROW_THRESHOLD;
}
