/**
 * Copy only the addresses `serialiseRadioFoundryCodeplug` stored.
 * A 0xFF hole the serialiser does not own stays as the byte read from the radio.
 */

export function overlayRadioFoundryOwned(
  radio: Uint8Array,
  serialised: Uint8Array,
  owned: Uint8Array,
): Uint8Array {
  if (radio.length !== serialised.length || radio.length !== owned.length) {
    throw new Error('RadioFoundry overlay inputs must be the same length.');
  }
  const out = radio.slice();
  for (let i = 0; i < out.length; i += 1) {
    if (owned[i]) out[i] = serialised[i]!;
  }
  return out;
}
