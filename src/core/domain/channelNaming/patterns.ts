/** Regional amateur callsign token patterns — phase 1 ([#54](https://github.com/pskillen/codeplug-tool/issues/54)). */

export interface CallsignPattern {
  id: string;
  label: string;
  /** Must match the full normalised token; patterns require at least one digit via test helper. */
  regex: RegExp;
}

export const CALLSIGN_TOKEN_PATTERNS: readonly CallsignPattern[] = [
  {
    id: 'uk-gb',
    label: 'UK GB repeater',
    regex: /^GB\d[A-Z]{2,3}$/i,
  },
  {
    id: 'uk-mb-simplex',
    label: 'UK simplex repeater',
    regex: /^MB[0-9][A-Z]{2,3}$/i,
  },
  {
    id: 'uk',
    label: 'UK',
    regex: /^(?:GM|GW|GI|GD|G|M|2E)\d[A-Z]{1,4}$/i,
  },
  {
    id: 'usa',
    label: 'USA',
    regex: /^(?:[KNW][A-Z]?|A[A-Z]?)\d[A-Z0-9]{1,3}$/i,
  },
  {
    id: 'canada',
    label: 'Canada',
    regex: /^(?:V[A-CEG-IO-Z]|CY)\d[A-Z0-9]{1,3}$/i,
  },
  {
    id: 'spain',
    label: 'Spain',
    regex: /^E[A-H]\d[A-Z0-9]{1,3}$/i,
  },
  {
    id: 'portugal',
    label: 'Portugal',
    regex: /^C[STU]\d[A-Z0-9]{1,3}$/i,
  },
  {
    id: 'italy',
    label: 'Italy',
    regex: /^I[A-Z]?\d[A-Z0-9]{1,3}$/i,
  },
  {
    id: 'france',
    label: 'France',
    regex: /^F[A-Z]?\d[A-Z0-9]{1,3}$/i,
  },
  {
    id: 'poland',
    label: 'Poland',
    regex: /^(?:SP|S[NOQR]|HF|3Z)\d[A-Z0-9]{1,3}$/i,
  },
  {
    id: 'germany',
    label: 'Germany',
    regex: /^D[LMNO]\d[A-Z0-9]{1,3}$/i,
  },
] as const;
