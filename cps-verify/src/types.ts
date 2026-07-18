/** Structured diagnostic from a wire-shape rule. */
export interface VerifyDiagnostic {
  /** Machine-readable rule id (e.g. `line-endings`, `foreign-key`). */
  rule: string;
  message: string;
  /** Bundle-relative file path when applicable. */
  file?: string;
  /** 1-based data row index (header = 0 conceptually; first data row = 1). */
  row?: number;
  /** Column header name when applicable. */
  column?: string;
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
  diagnostics: VerifyDiagnostic[];
  ok: boolean;
}

export interface FormatVerifier {
  id: string;
  /** Human label for CLI help. */
  label: string;
  verify(files: BundleFile[]): VerifyDiagnostic[];
}
