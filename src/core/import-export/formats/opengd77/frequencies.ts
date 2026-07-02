const HZ_PER_MHZ = 1_000_000;

/** Format Hz as MHz wire string (5 dp — OpenGD77 CPS convention). */
export function formatFrequencyMhzWireFromHz(hz: number | null): string {
  if (hz == null || hz <= 0) return '';
  const mhz = hz / HZ_PER_MHZ;
  return mhz.toFixed(5);
}
