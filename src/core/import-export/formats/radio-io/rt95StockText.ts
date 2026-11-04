/**
 * RT95 stock-firmware text boundary. The radio draws any printable ASCII, so stock names are
 * folded with `toRt95Ascii` at write time and keep their case. The stock CPS is narrower: it
 * accepts `0-9 A-Z -` only and shows every other byte as a space (and writes it back as a space).
 * That is not an error here, so it is a note beside the name, never a Write warning.
 * Source: firmware repo finding F122.
 */

/** A space stays a space in the CPS, so it needs no note. */
const CPS_SAFE_NAME = /^[0-9A-Z\- ]*$/;

/** Note text when `name` has characters the stock CPS would turn into spaces, else `undefined`. */
export function rt95StockCpsNameNote(name: string): string | undefined {
  if (CPS_SAFE_NAME.test(name)) return undefined;
  return 'The stock Retevis CPS only knows 0-9, A-Z and "-". If you open this radio in it, characters outside that set (including lower case) show as spaces and are written back as spaces.';
}
