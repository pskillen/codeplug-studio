import {
  decodeUv5rMiniFullRead,
  hashUv5rMiniDebugSpans,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { buildUv5rMiniReadsZip, Uv5rMiniDebugReadStore } from '../uv5rMiniDebugReads.ts';

/** A synthetic one-read legacy Mini reads ZIP; never operator data. */
export function syntheticZip() {
  const store = new Uv5rMiniDebugReadStore();
  const raw = new Uint8Array(0x10000).fill(0x37);
  const decoded = decodeUv5rMiniFullRead(raw);
  store.add(
    {
      raw,
      decoded,
      ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
      spans: hashUv5rMiniDebugSpans(decoded),
    },
    new Date('2026-01-01T00:00:00Z'),
  );
  return buildUv5rMiniReadsZip(store.getSnapshot().reads);
}
