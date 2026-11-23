/**
 * RadioFoundry firmware build identity (debug-link VERSION, RadioFoundry docs/spec/debuglink.md §3.1 at 454a5b76).
 * Self-reported by the radio; Studio does not verify it. Pure: no I/O.
 */

/** The RadioFoundry commit Studio's codec and cable write were checked against. */
export const RADIOFOUNDRY_STUDIO_PIN = {
  git: '454a5b76',
  gitTime: 1_795_365_604,
  date: '2026-11-22',
} as const;

export interface RadioFoundryBuildIdentity {
  proto?: number;
  /** As reported: 8 hex digits, optionally `-dirty`, or `unknown`. */
  git?: string;
  gitTime?: number;
  release?: string;
  source?: string;
  repo?: string;
  board?: string;
  preset?: string;
  codec?: string;
  features: readonly string[];
  off: readonly string[];
}

export type RadioFoundryBuildStanding = 'release' | 'pinned' | 'older' | 'newer' | 'unknown';

export interface RadioFoundryBuildSummary {
  /** One line for an identity row, e.g. "RadioFoundry 1a2b3c4d (2026-11-20)". */
  label: string;
  standing: RadioFoundryBuildStanding;
  dirty: boolean;
  /** Plain-language caveats, one sentence each. Empty for the pinned commit from an official build. */
  notes: string[];
}

const VERIFY_NOTE = 'Studio takes this from the radio and does not verify it.';

export function summariseRadioFoundryBuild(
  build: RadioFoundryBuildIdentity | null,
): RadioFoundryBuildSummary {
  if (build === null) {
    return {
      label: 'RadioFoundry (version not reported)',
      standing: 'unknown',
      dirty: false,
      notes: [
        'The radio did not report its firmware version, so Studio could not confirm which radio this is.',
      ],
    };
  }

  const commit = build.git?.match(/^[0-9a-f]+/i)?.[0]?.toLowerCase();
  const dirty = build.git?.endsWith('-dirty') ?? false;
  const pin = `${RADIOFOUNDRY_STUDIO_PIN.git}, ${RADIOFOUNDRY_STUDIO_PIN.date}`;
  const dirtyTag = dirty ? '-dirty' : '';

  let label: string;
  if (commit === undefined) {
    label = build.release ? `RadioFoundry ${build.release}` : 'RadioFoundry (commit not reported)';
  } else if (build.release) {
    label = `RadioFoundry ${build.release} (${commit}${dirtyTag})`;
  } else {
    label = `RadioFoundry ${commit}${dirtyTag}`;
    if (build.gitTime !== undefined) {
      label += ` (${new Date(build.gitTime * 1000).toISOString().slice(0, 10)})`;
    }
  }

  let standing: RadioFoundryBuildStanding;
  if (commit === undefined) standing = 'unknown';
  else if (commit === RADIOFOUNDRY_STUDIO_PIN.git) standing = 'pinned';
  else if (build.gitTime !== undefined) {
    if (build.gitTime < RADIOFOUNDRY_STUDIO_PIN.gitTime) standing = 'older';
    else if (build.gitTime > RADIOFOUNDRY_STUDIO_PIN.gitTime) standing = 'newer';
    else standing = 'pinned';
  } else standing = build.release ? 'release' : 'unknown';

  const notes: string[] = [];
  if (commit === undefined) notes.push('The radio did not report a git commit.');
  if (standing === 'older') {
    notes.push(`Older than the RadioFoundry build Studio was checked against (${pin}).`);
  }
  if (standing === 'newer') {
    notes.push(`Newer than the RadioFoundry build Studio was checked against (${pin}).`);
  }
  if (dirty) {
    notes.push("Built from uncommitted changes; its date is the build's, not a commit's.");
  }
  if (build.source && build.source !== 'official' && build.source !== 'service') {
    notes.push(
      `Built by ${build.repo ?? 'an unnamed repository'} (${build.source}), as the radio reports it.`,
    );
  }
  if (notes.length > 0 || !build.source) notes.push(VERIFY_NOTE);

  return { label, standing, dirty, notes };
}
