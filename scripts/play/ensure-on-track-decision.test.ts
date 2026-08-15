import { describe, expect, it } from 'vitest';
import {
  PLAY_NOTES_MAX,
  assertPlayTrackAllowed,
  decideEnsureAction,
  releaseNotesFor,
  trackHasCompletedCode,
} from './ensure-on-track-decision.mjs';

describe('assertPlayTrackAllowed', () => {
  it('refuses an RC on Production', () => {
    expect(() => assertPlayTrackAllowed('1.2.3-rc.4', 'production')).toThrow(/Refusing/);
  });

  it('allows an RC on Open testing and a final on Production', () => {
    expect(() => assertPlayTrackAllowed('1.2.3-rc.4', 'beta')).not.toThrow();
    expect(() => assertPlayTrackAllowed('1.2.3', 'production')).not.toThrow();
  });
});

describe('decideEnsureAction', () => {
  it('patches when the bundle is already on Play', () => {
    expect(decideEnsureAction({ bundlePresent: true })).toBe('patch');
    expect(decideEnsureAction({ bundlePresent: true, aabPath: '/tmp/app.aab' })).toBe('patch');
  });

  it('uploads when the code is absent and an AAB is provided', () => {
    expect(decideEnsureAction({ bundlePresent: false, aabPath: '/tmp/app.aab' })).toBe('upload');
  });

  it('reports a missing bundle when reconciling a code Play does not hold', () => {
    expect(decideEnsureAction({ bundlePresent: false })).toBe('missing-bundle');
  });
});

describe('trackHasCompletedCode', () => {
  it('is true only for a completed release listing the code', () => {
    expect(
      trackHasCompletedCode(
        { releases: [{ status: 'completed', versionCodes: ['20704'] }] },
        20704,
      ),
    ).toBe(true);
    expect(
      trackHasCompletedCode({ releases: [{ status: 'draft', versionCodes: [20704] }] }, 20704),
    ).toBe(false);
    expect(trackHasCompletedCode(null, 20704)).toBe(false);
  });
});

describe('releaseNotesFor', () => {
  it('falls back when the GitHub body is empty', () => {
    expect(releaseNotesFor('', '1.2.3')).toMatch(/Codeplug Studio 1\.2\.3/);
  });

  it('truncates to Play’s 500-character limit', () => {
    const notes = releaseNotesFor('x'.repeat(600), '1.0.0');
    expect(notes.length).toBe(PLAY_NOTES_MAX);
    expect(notes.endsWith('…')).toBe(true);
  });
});
