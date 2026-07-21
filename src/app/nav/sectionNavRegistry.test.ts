import { describe, expect, it } from 'vitest';
import { resolveSectionNav, shouldShowSecondaryNav } from './sectionNavRegistry.ts';

describe('sectionNavRegistry', () => {
  it('resolves build detail routes to Export for radio nav', () => {
    const entry = resolveSectionNav('/builds/abc-123/overview');
    expect(entry?.title).toBe('Export for radio');
    expect(entry?.Component).toBeDefined();
  });

  it('does not resolve builds list or new-build routes', () => {
    expect(resolveSectionNav('/builds')).toBeNull();
    expect(resolveSectionNav('/builds/new')).toBeNull();
  });

  it('shows secondary nav on build detail when a project is active', () => {
    expect(shouldShowSecondaryNav('/builds/abc-123/channels', true)).toBe(true);
    expect(shouldShowSecondaryNav('/builds/abc-123/channels', false)).toBe(false);
  });

  it('hides secondary nav on builds list', () => {
    expect(shouldShowSecondaryNav('/builds', true)).toBe(false);
    expect(shouldShowSecondaryNav('/builds/new', true)).toBe(false);
  });

  it('shows library secondary nav on APRS configuration page', () => {
    const entry = resolveSectionNav('/library/aprs-configuration');
    expect(entry?.title).toBe('APRS configuration');
    expect(shouldShowSecondaryNav('/library/aprs-configuration', true)).toBe(true);
  });
});
