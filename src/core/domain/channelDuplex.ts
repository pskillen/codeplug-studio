/** True when both RX and TX are set and equal (simplex). Null freqs are not simplex. */
export function isSimplex(rxHz: number | null, txHz: number | null): boolean {
  if (rxHz == null || txHz == null) return false;
  return rxHz === txHz;
}
