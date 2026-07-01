/** Dotted initialisms (e.g. N.I., U.S.A.) — keep uppercase through title casing. */
export const DOTTED_ABBREV_PATTERN = /(?:[A-Z]\.)+(?=\s|$)/;

function titleCaseSegment(segment: string): string {
  return segment.toLowerCase().replace(/(?:^|[\s/'-])\w/g, (match) => match.toUpperCase());
}

/** Title-case directory text fields (e.g. DERBY → Derby, BELFAST N.I. → Belfast N.I.). */
export function toTitleCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const matches: { start: number; end: number; text: string }[] = [];
  const re = new RegExp(DOTTED_ABBREV_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }

  if (matches.length === 0) return titleCaseSegment(trimmed);

  let result = '';
  let last = 0;
  for (const part of matches) {
    if (part.start > last) {
      result += titleCaseSegment(trimmed.slice(last, part.start));
    }
    result += part.text;
    last = part.end;
  }
  if (last < trimmed.length) {
    result += titleCaseSegment(trimmed.slice(last));
  }
  return result;
}
