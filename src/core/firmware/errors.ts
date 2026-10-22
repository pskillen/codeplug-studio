export type FirmwareErrorCode =
  | 'stock-corrupt-zip'
  | 'stock-missing-member'
  | 'stock-duplicate-member'
  /** Right file names, wrong hashes or sizes. */
  | 'stock-wrong-version'
  /** Matches another radio's pinned stock. */
  | 'stock-wrong-radio'
  /** Matches a known patched result. */
  | 'stock-is-patched'
  | 'patch-unreadable'
  | 'patch-unknown-format'
  | 'patch-wrong-radio'
  | 'patch-wrong-stock'
  | 'patch-malformed'
  | 'patch-original-mismatch'
  | 'patch-result-mismatch';

/** A firmware refusal. `message` is written for the operator; `code` is for branching. */
export class FirmwareError extends Error {
  constructor(
    readonly code: FirmwareErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FirmwareError';
  }
}
