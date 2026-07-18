import { getVerifier, listVerifierIds, listProfilesForFormat } from './formats/registry.ts';
import { loadBundle } from './loadBundle.ts';
import type { VerifyResult } from './types.ts';

export interface VerifyOptions {
  format: string;
  /** When omitted, the format plugin's defaultProfileId is used. */
  profile?: string;
  path: string;
}

/** Verify a CPS directory or ZIP against the selected format + profile plugin. */
export async function verifyCodeplug(opts: VerifyOptions): Promise<VerifyResult> {
  const verifier = getVerifier(opts.format);
  if (!verifier) {
    const known = listVerifierIds().join(', ') || '(none)';
    return {
      format: opts.format,
      profile: opts.profile ?? '',
      ok: false,
      diagnostics: [
        {
          rule: 'format',
          message: `Unknown format ${JSON.stringify(opts.format)}. Known: ${known}.`,
        },
      ],
    };
  }

  const profileId = opts.profile?.trim() || verifier.defaultProfileId;
  if (!verifier.supportedProfileIds.includes(profileId)) {
    const known = listProfilesForFormat(opts.format).join(', ');
    return {
      format: opts.format,
      profile: profileId,
      ok: false,
      diagnostics: [
        {
          rule: 'profile',
          message: `Unknown profile ${JSON.stringify(profileId)} for format ${JSON.stringify(opts.format)}. Known: ${known}.`,
        },
      ],
    };
  }

  const files = await loadBundle(opts.path);
  const diagnostics = verifier.verify(files, profileId);
  return {
    format: opts.format,
    profile: profileId,
    diagnostics,
    ok: diagnostics.length === 0,
  };
}

export { listVerifierIds, getVerifier, listProfilesForFormat };
