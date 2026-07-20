import { describe, expect, it } from 'vitest';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { resolveOptimisticBuild } from './resolveOptimisticBuild.ts';

function build(revision: number, name: string): FormatBuild {
  return {
    id: 'b1',
    projectId: 'p1',
    name,
    formatId: 'opengd77',
    profileId: 'opengd77-gd77',
    layout: { sections: [] },
    channelOverrides: [],
    zoneOverrides: [],
    scanListOverrides: [],
    talkGroupOverrides: [],
    rxGroupListOverrides: [],
    contactOverrides: [],
    updatedAt: '2020-01-01T00:00:00.000Z',
    revision,
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
