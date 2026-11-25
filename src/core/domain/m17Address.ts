export const M17_DESTINATION_ERROR =
  'M17 destination must be blank, ALL, or 1–9 letters, digits, hyphens, slashes, periods or spaces';
export const M17_CALLSIGN_ERROR =
  'M17 callsign must be 1–9 letters, digits, hyphens, slashes or periods';
export const M17_CAN_ERROR = 'M17 CAN must be an integer from 0 to 15';

export function isM17Can(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 15;
}

/** The empty string represents broadcast. Null means the text is invalid. */
export function normalizeM17Destination(text: string): string | null {
  const value = text.trim();
  if (value === '' || /^@?[Aa][Ll][Ll]$/.test(value)) return '';
  return /^[A-Za-z0-9 ./-]{1,9}$/.test(value) ? value.toUpperCase() : null;
}

/** Operator callsigns have no spaces after trimming. Null means the text is invalid. */
export function normalizeM17Callsign(text: string): string | null {
  const value = text.trim();
  return /^[A-Za-z0-9./-]{1,9}$/.test(value) ? value.toUpperCase() : null;
}
