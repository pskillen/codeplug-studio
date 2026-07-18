import { getVerifier, listVerifierIds } from './formats/registry.ts';
import { loadBundle } from './loadBundle.ts';
import type { VerifyResult } from './types.ts';

export interface VerifyOptions {
  format: string;
  path: string;
}

/** Verify a CPS directory or ZIP against the selected format plugin. */
export async function verifyCodeplug(opts: VerifyOptions): Promise<VerifyResult> {
  const verifier = getVerifier(opts.format);
  if (!verifier) {
    const known = listVerifierIds().join(', ') || '(none)';
    return {
      format: opts.format,
      ok: false,
      diagnostics: [
        {
          rule: 'format',
          message: `Unknown format ${JSON.stringify(opts.format)}. Known: ${known}.`,
        },
      ],
    };
  }
  const files = await loadBundle(opts.path);
  const diagnostics = verifier.verify(files);
  return {
    format: opts.format,
    diagnostics,
    ok: diagnostics.length === 0,
  };
}

export { listVerifierIds, getVerifier };
