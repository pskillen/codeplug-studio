import { describe, expect, it } from 'vitest';
import { GRADIENT_SEGMENT_IDLE_VALUE } from '../components/ui/GradientSegmentedControl.tsx';
import {
  BULK_LEVEL_CUSTOM,
  BULK_LEVEL_DEFAULT,
  bulkLevelSegmentValue,
  sharedLevelSegmentValue,
} from './bulkEditIdle.ts';

describe('bulkLevelSegmentValue', () => {
  it('is idle when the level is not opted in', () => {
    expect(bulkLevelSegmentValue(false, 50)).toBe(GRADIENT_SEGMENT_IDLE_VALUE);
  });

  it('uses Default when opted in with a null level', () => {
    expect(bulkLevelSegmentValue(true, null)).toBe(BULK_LEVEL_DEFAULT);
  });

  it('uses Custom when opted in with a percent', () => {
    expect(bulkLevelSegmentValue(true, 50)).toBe(BULK_LEVEL_CUSTOM);
  });
});

describe('sharedLevelSegmentValue', () => {
  it('is undefined when the selection is mixed', () => {
    expect(sharedLevelSegmentValue(undefined)).toBeUndefined();
  });

  it('maps radio default and percents onto Default and Custom', () => {
    expect(sharedLevelSegmentValue(null)).toBe(BULK_LEVEL_DEFAULT);
    expect(sharedLevelSegmentValue(25)).toBe(BULK_LEVEL_CUSTOM);
  });
});
