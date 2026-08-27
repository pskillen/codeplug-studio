import { GRADIENT_SEGMENT_IDLE_VALUE } from '../components/ui/GradientSegmentedControl.tsx';
import type { GradientSegmentOption } from '../components/ui/GradientSegmentedControl.tsx';

export const BULK_IDLE_OPTION: GradientSegmentOption<typeof GRADIENT_SEGMENT_IDLE_VALUE> = {
  value: GRADIENT_SEGMENT_IDLE_VALUE,
  label: 'No change',
};

export function bulkSegmentValue<T extends string>(
  optedIn: boolean,
  value: T,
): T | typeof GRADIENT_SEGMENT_IDLE_VALUE {
  return optedIn ? value : GRADIENT_SEGMENT_IDLE_VALUE;
}

export function applyBulkSegmentChange<T extends string>(
  next: string,
  setOptedIn: (optedIn: boolean) => void,
  setValue: (value: T) => void,
): void {
  if (next === GRADIENT_SEGMENT_IDLE_VALUE) {
    setOptedIn(false);
    return;
  }
  setOptedIn(true);
  setValue(next as T);
}

export function changeBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count === 1 ? '1 change' : `${count} changes`;
}

export const BULK_POWER_DEFAULT = 'default';
export const BULK_POWER_CUSTOM = 'custom';

export function bulkPowerSegmentValue(
  changePower: boolean,
  power: number | null,
): typeof GRADIENT_SEGMENT_IDLE_VALUE | typeof BULK_POWER_DEFAULT | typeof BULK_POWER_CUSTOM {
  if (!changePower) return GRADIENT_SEGMENT_IDLE_VALUE;
  return power == null ? BULK_POWER_DEFAULT : BULK_POWER_CUSTOM;
}

export function sharedPowerSegmentValue(
  power: number | null | undefined,
): typeof BULK_POWER_DEFAULT | typeof BULK_POWER_CUSTOM | undefined {
  if (power === undefined) return undefined;
  return power == null ? BULK_POWER_DEFAULT : BULK_POWER_CUSTOM;
}
