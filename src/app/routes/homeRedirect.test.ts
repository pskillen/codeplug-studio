import { describe, expect, it } from 'vitest';
import { shouldRedirectHomeToLibrary } from './homeRedirect.ts';

describe('shouldRedirectHomeToLibrary', () => {
  it('does not redirect while projects are loading', () => {
    expect(shouldRedirectHomeToLibrary(true, 'p1', new URLSearchParams())).toBe(false);
  });

  it('does not redirect when no project is selected', () => {
    expect(shouldRedirectHomeToLibrary(false, null, new URLSearchParams())).toBe(false);
  });

  it('redirects to library when a project is selected', () => {
    expect(shouldRedirectHomeToLibrary(false, 'p1', new URLSearchParams())).toBe(true);
  });

  it('stays on the picker when manage is in the query', () => {
    expect(shouldRedirectHomeToLibrary(false, 'p1', new URLSearchParams('manage=1'))).toBe(false);
  });
});
