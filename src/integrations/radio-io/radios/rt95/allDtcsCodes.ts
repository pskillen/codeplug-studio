/** CHIRP `chirp_common.ALL_DTCS_CODES` — 512 octal-style codes 000–777. */

function buildAllDtcsCodes(): readonly number[] {
  const codes: number[] = [];
  for (let a = 0; a < 8; a++) {
    for (let b = 0; b < 8; b++) {
      for (let c = 0; c < 8; c++) {
        codes.push(a * 100 + b * 10 + c);
      }
    }
  }
  return Object.freeze(codes);
}

export const ALL_DTCS_CODES: readonly number[] = buildAllDtcsCodes();

export function dtcsCodeToWireIndex(code: number): number | null {
  const idx = ALL_DTCS_CODES.indexOf(code);
  return idx >= 0 ? idx : null;
}

export function dtcsWireIndexToCode(index: number): number | null {
  return ALL_DTCS_CODES[index] ?? null;
}
