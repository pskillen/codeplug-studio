/** Structured diagnostic from a wire-shape rule. */
export interface VerifyDiagnostic {
  /** Machine-readable rule id (e.g. `line-endings`, `foreign-key`). */
  rule: string;
  message: string;
  /** Named check id when produced via {@link FormatVerifier.verifyDetailed}. */
  check?: string;
  /** Bundle-relative file path when applicable. */
  file?: string;
  /** 1-based data row index (header = 0 conceptually; first data row = 1). */
  row?: number;
  /** Column header name when applicable. */
  column?: string;
}

/** One named verification step for Vitest / Dorny reporting. */
export interface VerifyCheck {
  /** Stable id (e.g. `headers.Channel.CSV`, `fk.zone.channel`). */
  id: string;
  /** Existing rule taxonomy (`line-endings`, `foreign-key`, …). */
  rule: string;
  /** Short human label for reports. */
  label: string;
}

/** Result of one named check that actually ran. */
export interface CheckOutcome {
  check: VerifyCheck;
  diagnostics: VerifyDiagnostic[];
  ok: boolean;
}

/** One file loaded from a directory or ZIP. */
export interface BundleFile {
  /** Path relative to bundle root (forward slashes). */
  path: string;
  /** Basename for matching (e.g. `Channel.CSV`). */
  name: string;
  /** Raw file bytes as UTF-8 text (BOM may be present). */
  text: string;
}

export interface VerifyResult {
  format: string;
  profile: string;
  diagnostics: VerifyDiagnostic[];
  ok: boolean;
}

/** Detailed verify result with one outcome per check that ran. */
export interface VerifyDetailedResult {
  format: string;
  profile: string;
  outcomes: CheckOutcome[];
  diagnostics: VerifyDiagnostic[];
  ok: boolean;
}

export interface FormatVerifier {
  /** formatId (e.g. `anytone`, `dm32`). */
  id: string;
  /** Human label for CLI help. */
  label: string;
  /** Default profileId when CLI omits --profile. */
  defaultProfileId: string;
  /** Profiles this plugin can verify. */
  supportedProfileIds: readonly string[];
  /** Named checks that ran for this bundle (pass inventory + failures). */
  verifyDetailed(files: BundleFile[], profileId: string): CheckOutcome[];
  /** Flat diagnostics — typically `verifyDetailed(...).flatMap((o) => o.diagnostics)`. */
  verify(files: BundleFile[], profileId: string): VerifyDiagnostic[];
}

/** Build a {@link CheckOutcome}, tagging each diagnostic with `check.id`. */
export function checkOutcome(
  check: VerifyCheck,
  diagnostics: VerifyDiagnostic[],
): CheckOutcome {
  const tagged = diagnostics.map((d) => ({ ...d, check: check.id }));
  return {
    check,
    diagnostics: tagged,
    ok: tagged.length === 0,
  };
}

/** Flatten check outcomes to the legacy diagnostic list. */
export function flattenOutcomes(outcomes: CheckOutcome[]): VerifyDiagnostic[] {
  return outcomes.flatMap((o) => o.diagnostics);
}
