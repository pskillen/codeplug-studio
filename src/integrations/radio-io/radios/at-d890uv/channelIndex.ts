/**
 * AT-D890UV wire uses 0-based global channel indices (ch->id).
 * RadioWriteProjection supplies 1-based channel numbers.
 */

/** Convert 1-based projection channel number to 0-based D890 wire index. */
export function toAtD890ChannelIndex(oneBased: number): number {
  return Math.max(0, oneBased - 1);
}
