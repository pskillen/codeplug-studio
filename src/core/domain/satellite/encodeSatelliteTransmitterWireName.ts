/**
 * Combine a satellite short name with a transmitter label into the radio name field budget.
 * Vendor-neutral rule documented for Anytone D890; OpenGD77 siblings may share the pattern.
 */
export function encodeSatelliteTransmitterWireName(
  satelliteShortName: string,
  transmitterLabel: string,
  maxLength: number,
): string {
  const name = satelliteShortName.trim();
  if (name.length >= maxLength) {
    return name.slice(0, maxLength);
  }
  const combined = `${name} ${transmitterLabel}`.trim();
  return combined.slice(0, maxLength);
}

/** Trim padding spaces for display; wire write may pad separately. */
export function trimEncodedWireName(encoded: string): string {
  return encoded.trimEnd();
}
