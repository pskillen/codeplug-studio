import { describe, expect, it } from 'vitest';
import {
  RADIOFOUNDRY_STUDIO_PIN,
  summariseRadioFoundryBuild,
  type RadioFoundryBuildIdentity,
} from './firmware.ts';

function build(partial: Partial<RadioFoundryBuildIdentity>): RadioFoundryBuildIdentity {
  return { features: [], off: [], ...partial };
}

const PIN_TEXT = `${RADIOFOUNDRY_STUDIO_PIN.git}, ${RADIOFOUNDRY_STUDIO_PIN.date}`;
const OLDER = `Older than the RadioFoundry build Studio was checked against (${PIN_TEXT}).`;
const NEWER = `Newer than the RadioFoundry build Studio was checked against (${PIN_TEXT}).`;
const VERIFY = 'Studio takes this from the radio and does not verify it.';

describe('summariseRadioFoundryBuild', () => {
  it('is pinned with no notes for the checked commit from an official build', () => {
    const s = summariseRadioFoundryBuild(
      build({ git: 'adfbfce7', gitTime: 1795626273, source: 'official' }),
    );
    expect(s.standing).toBe('pinned');
    expect(s.label).toBe('RadioFoundry adfbfce7 (2026-11-25)');
    expect(s.notes).toEqual([]);
  });

  it('is older and newer by git_time', () => {
    const older = summariseRadioFoundryBuild(
      build({ git: '1a2b3c4d', gitTime: RADIOFOUNDRY_STUDIO_PIN.gitTime - 1, source: 'official' }),
    );
    expect(older.standing).toBe('older');
    expect(older.notes).toEqual([OLDER, VERIFY]);
    const newer = summariseRadioFoundryBuild(
      build({ git: '1a2b3c4d', gitTime: RADIOFOUNDRY_STUDIO_PIN.gitTime + 1, source: 'official' }),
    );
    expect(newer.standing).toBe('newer');
    expect(newer.notes).toEqual([NEWER, VERIFY]);
  });

  it('names a release with and without git_time', () => {
    const s = summariseRadioFoundryBuild(
      build({ git: '1a2b3c4d', release: 'v1.0', source: 'official' }),
    );
    expect(s.standing).toBe('release');
    expect(s.label).toBe('RadioFoundry v1.0 (1a2b3c4d)');
    expect(s.notes).toEqual([]);
    const withTime = summariseRadioFoundryBuild(
      build({
        git: '1a2b3c4d',
        release: 'v1.0',
        source: 'official',
        gitTime: RADIOFOUNDRY_STUDIO_PIN.gitTime + 1,
      }),
    );
    expect(withTime.standing).toBe('newer');
  });

  it('marks a dirty build', () => {
    const s = summariseRadioFoundryBuild(
      build({ git: '1a2b3c4d-dirty', gitTime: 1795365605, source: 'local' }),
    );
    expect(s.dirty).toBe(true);
    expect(s.label.startsWith('RadioFoundry 1a2b3c4d-dirty (')).toBe(true);
    expect(s.notes).toContain(
      "Built from uncommitted changes; its date is the build's, not a commit's.",
    );
    expect(s.notes).toContain('Built by an unnamed repository (local), as the radio reports it.');
    expect(s.notes[s.notes.length - 1]).toBe(VERIFY);
  });

  it('handles git=unknown and a missing git', () => {
    for (const git of ['unknown', undefined]) {
      const s = summariseRadioFoundryBuild(build({ git }));
      expect(s.standing).toBe('unknown');
      expect(s.label).toBe('RadioFoundry (commit not reported)');
      expect(s.notes[0]).toBe('The radio did not report a git commit.');
    }
  });

  it('handles no VERSION at all', () => {
    expect(summariseRadioFoundryBuild(null)).toEqual({
      label: 'RadioFoundry (version not reported)',
      standing: 'unknown',
      dirty: false,
      notes: [
        'The radio did not report its firmware version, so Studio could not confirm which radio this is.',
      ],
    });
  });

  it('names the repository of a fork', () => {
    const s = summariseRadioFoundryBuild(
      build({ git: '1a2b3c4d', gitTime: 1795365605, source: 'fork', repo: 'example/rf' }),
    );
    expect(s.notes).toContain('Built by example/rf (fork), as the radio reports it.');
  });

  it('writes the label date in UTC', () => {
    const s = summariseRadioFoundryBuild(
      build({ git: '1a2b3c4d', gitTime: 1795391999, source: 'official' }),
    );
    expect(s.label.endsWith('(2026-11-22)')).toBe(true);
  });

  it('takes the pin from one constant', () => {
    expect(RADIOFOUNDRY_STUDIO_PIN.git).toBe('adfbfce7');
    for (const gitTime of [
      RADIOFOUNDRY_STUDIO_PIN.gitTime - 1,
      RADIOFOUNDRY_STUDIO_PIN.gitTime + 1,
    ]) {
      const s = summariseRadioFoundryBuild(build({ git: '1a2b3c4d', gitTime, source: 'official' }));
      expect(s.notes[0]).toContain(RADIOFOUNDRY_STUDIO_PIN.date);
    }
  });
});
