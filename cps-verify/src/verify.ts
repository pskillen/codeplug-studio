import { getVerifier, listVerifierIds, listProfilesForFormat } from './formats/registry.ts';
import { loadBundle } from './loadBundle.ts';
import { flattenOutcomes } from './types.ts';
import type { VerifyDetailedResult, VerifyResult } from './types.ts';

export interface VerifyOptions {
  format: string;
  /** When omitted, the format plugin's defaultProfileId is used. */
  profile?: string;
  path: string;
}

function unknownFormatResult(format: string): VerifyDetailedResult {
  const known = listVerifierIds().join(', ') || '(none)';
  const diagnostics = [
    {
      rule: 'format',
      check: 'format',
      message: `Unknown format ${JSON.stringify(format)}. Known: ${known}.`,
    },
  ];
  return {
    format,
    profile: '',
    outcomes: [
      {
        check: { id: 'format', rule: 'format', label: 'Format id' },
        diagnostics,
        ok: false,
      },
    ],
    diagnostics,
    ok: false,
  };
}

function unknownProfileResult(format: string, profileId: string): VerifyDetailedResult {
  const known = listProfilesForFormat(format).join(', ');
  const diagnostics = [
    {
      rule: 'profile',
      check: 'profile',
      message: `Unknown profile ${JSON.stringify(profileId)} for format ${JSON.stringify(format)}. Known: ${known}.`,
    },
  ];
  return {
    format,
    profile: profileId,
    outcomes: [
      {
        check: { id: 'profile', rule: 'profile', label: 'Profile id' },
        diagnostics,
        ok: false,
      },
    ],
    diagnostics,
    ok: false,
  };
}

/** Verify a CPS directory or ZIP; returns one outcome per named check that ran. */
export async function verifyCodeplugDetailed(opts: VerifyOptions): Promise<VerifyDetailedResult> {
  const verifier = getVerifier(opts.format);
  if (!verifier) {
    return unknownFormatResult(opts.format);
  }

  const profileId = opts.profile?.trim() || verifier.defaultProfileId;
  if (!verifier.supportedProfileIds.includes(profileId)) {
    return unknownProfileResult(opts.format, profileId);
  }

  const files = await loadBundle(opts.path);
  const outcomes = verifier.verifyDetailed(files, profileId);
  const diagnostics = flattenOutcomes(outcomes);
  return {
    format: opts.format,
    profile: profileId,
    outcomes,
    diagnostics,
    ok: diagnostics.length === 0,
  };
}

/** Verify a CPS directory or ZIP against the selected format + profile plugin. */
export async function verifyCodeplug(opts: VerifyOptions): Promise<VerifyResult> {
  const detailed = await verifyCodeplugDetailed(opts);
  return {
    format: detailed.format,
    profile: detailed.profile,
    diagnostics: detailed.diagnostics,
    ok: detailed.ok,
  };
}

export { listVerifierIds, getVerifier, listProfilesForFormat };
