import { strFromU8, unzipSync } from 'fflate';
import {
  decodeUv5rMiniFullRead,
  UV5R_MINI_FULL_READ_SIZE,
  hashUv5rMiniDebugSpans,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import type { Uv5rMiniDebugRead } from '../uv5rMiniDebugReads.ts';

/** Open the legacy multi-read ZIP without inferring live report provenance. */
export function openUv5rMiniReadsZip(bytes: Uint8Array): Uv5rMiniDebugRead[] {
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  const labels = [
    ...new Set(
      names.map((name) => /^([A-Z]+)\/(raw\.bin|decoded\.bin|summary\.txt)$/.exec(name)?.[1]),
    ),
  ];
  if (!labels.length || labels.includes(undefined) || names.length !== labels.length * 3)
    throw new Error('Invalid Mini reads archive entries.');
  return labels.map((label) => {
    const raw = files[`${label}/raw.bin`];
    const decoded = files[`${label}/decoded.bin`];
    const summary = files[`${label}/summary.txt`];
    if (
      !raw ||
      !decoded ||
      !summary ||
      raw.length !== UV5R_MINI_FULL_READ_SIZE ||
      decoded.length !== UV5R_MINI_FULL_READ_SIZE ||
      !decodeUv5rMiniFullRead(raw).every((b, i) => b === decoded[i])
    )
      throw new Error('Invalid Mini read bytes.');
    const text = strFromU8(summary);
    const time = /^Time (.+)$/m.exec(text)?.[1];
    const f = /^F ([0-9a-f]{32})$/im.exec(text)?.[1];
    const m = /^M ([0-9a-f]{30})$/im.exec(text)?.[1];
    if (
      !time ||
      !f ||
      !m ||
      !new RegExp(`^Read ${label}$`, 'm').test(text) ||
      !Number.isFinite(Date.parse(time))
    )
      throw new Error('Invalid Mini read summary.');
    const spans = hashUv5rMiniDebugSpans(decoded);
    if (spans.some(({ sha256 }) => !text.includes(sha256)))
      throw new Error('Invalid Mini read summary hashes.');
    const hex = (value: string) =>
      Uint8Array.from(value.match(/../g)!, (pair) => parseInt(pair, 16));
    return {
      label: label!,
      readAt: new Date(time),
      raw,
      decoded,
      ident: { f: hex(f), m: hex(m) },
      spans,
    };
  });
}
