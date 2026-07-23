import { describe, expect, it } from 'vitest';
import { newRadioBuild } from '@core/domain/factories.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { resolveOptimisticBuild } from './resolveOptimisticBuild.ts';

function build(revision: number, name: string): RadioBuild {
  return {
    ...newRadioBuild('p1', 'baofeng-dm1701', name),
    revision,
    updatedAt: '2020-01-01T00:00:00.000Z',
  };
}

describe('resolveOptimisticBuild', () => {
  it('uses context when there is no optimistic save', () => {
    const context = build(3, 'context');
    expect(resolveOptimisticBuild(context, null)).toBe(context);
  });

  it('uses optimistic save while it is ahead of context', () => {
    const context = build(3, 'context');
    const saved = build(4, 'saved');
    expect(resolveOptimisticBuild(context, saved)).toBe(saved);
  });

  it('uses context when revisions match', () => {
    const context = build(4, 'context');
    const saved = build(4, 'saved');
    expect(resolveOptimisticBuild(context, saved)).toBe(context);
  });

  it('uses context when context advanced past the optimistic save', () => {
    const context = build(5, 'context-with-layout');
    const saved = build(4, 'stale-skip');
    expect(resolveOptimisticBuild(context, saved)).toBe(context);
  });
});
