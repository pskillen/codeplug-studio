/**
 * Printable ASCII of a fixed-width field: stops at the first `00` or `FF`, any other byte outside
 * 0x20-0x7E shows as `.`. Display only; the stored bytes are never changed.
 */
export function readAsciiField(data: Uint8Array, offset: number, length: number): string {
  const slice = data.subarray(offset, Math.min(data.length, offset + length));
  let end = slice.length;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === 0 || slice[i] === 0xff) {
      end = i;
      break;
    }
  }
  const chars: string[] = [];
  for (let i = 0; i < end; i++) {
    const c = slice[i]!;
    chars.push(c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '.');
  }
  return chars.join('').trim();
}
