/** Last four characters of a serial, with a leading ellipsis (never the whole number). */
export function maskSerial(serial: string): string {
  const trimmed = serial.trim();
  return trimmed.length <= 4 ? `…${trimmed}` : `…${trimmed.slice(-4)}`;
}
