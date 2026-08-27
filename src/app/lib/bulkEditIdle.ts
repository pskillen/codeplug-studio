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

/** Shared by Power and analog squelch: No change | Default | Custom. */
export const BULK_LEVEL_DEFAULT = 'default';
export const BULK_LEVEL_CUSTOM = 'custom';

export function bulkLevelSegmentValue(
  optedIn: boolean,
  level: number | null,
): typeof GRADIENT_SEGMENT_IDLE_VALUE | typeof BULK_LEVEL_DEFAULT | typeof BULK_LEVEL_CUSTOM {
  if (!optedIn) return GRADIENT_SEGMENT_IDLE_VALUE;
  return level == null ? BULK_LEVEL_DEFAULT : BULK_LEVEL_CUSTOM;
}

export function sharedLevelSegmentValue(
  level: number | null | undefined,
): typeof BULK_LEVEL_DEFAULT | typeof BULK_LEVEL_CUSTOM | undefined {
  if (level === undefined) return undefined;
  return level == null ? BULK_LEVEL_DEFAULT : BULK_LEVEL_CUSTOM;
}
