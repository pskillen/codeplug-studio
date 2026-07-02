/** Common Unicode punctuation → ASCII before stripping remaining non-ASCII. */
const UNICODE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['\u2014', '-'], // em dash
  ['\u2013', '-'], // en dash
  ['\u2018', "'"], // left single quote
  ['\u2019', "'"], // right single quote
  ['\u201C', '"'], // left double quote
  ['\u201D', '"'], // right double quote
];

/**
 * Normalise a CPS wire string to printable ASCII.
 * Replaces common Unicode punctuation, then strips any remaining non-ASCII.
 */
export function sanitiseAsciiWireString(value: string): string {
  let result = value;
  for (const [from, to] of UNICODE_REPLACEMENTS) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }
  return result.replace(/[^\x20-\x7E]/g, '');
}
