/**
 * LZ4 block codec (no frame header). Port of RadioFoundry `site/static/js/flasher/lz4.js`
 * (MIT). One 4096-byte codeplug block is one LZ4 block.
 */

export class Lz4Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Lz4Error';
  }
}

/** Decode one LZ4 block to exactly `size` bytes. */
export function decodeBlock(src: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let i = 0;
  let o = 0;
  const n = src.length;
  const ext = (start: number): number => {
    let v = start;
    for (;;) {
      if (i >= n) throw new Lz4Error('truncated LZ4 block');
      const b = src[i++]!;
      v += b;
      if (b !== 255) return v;
    }
  };
  while (i < n) {
    const tok = src[i++]!;
    let lit = tok >> 4;
    if (lit === 15) lit = ext(lit);
    if (i + lit > n || o + lit > size) throw new Lz4Error('corrupt LZ4 block');
    out.set(src.subarray(i, i + lit), o);
    i += lit;
    o += lit;
    if (i >= n) break;
    if (i + 2 > n) throw new Lz4Error('truncated LZ4 block');
    const off = src[i]! | (src[i + 1]! << 8);
    i += 2;
    let ml = tok & 15;
    if (ml === 15) ml = ext(ml);
    ml += 4;
    if (off === 0 || off > o || o + ml > size) throw new Lz4Error('corrupt LZ4 block');
    for (let k = 0; k < ml; k += 1, o += 1) out[o] = out[o - off]!;
  }
  if (o !== size) throw new Lz4Error(`LZ4 block decodes to ${o} bytes, wanted ${size}`);
  return out;
}

/** Encode one buffer as an LZ4 block. The matching decoder accepts the stream. */
export function encodeBlock(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  const seen = new Map<number, number>();
  let ip = 0;
  let anchor = 0;
  const n = src.length;
  const ext = (start: number): void => {
    let v = start;
    while (v >= 255) {
      out.push(255);
      v -= 255;
    }
    out.push(v);
  };
  const literals = (from: number, to: number): void => {
    for (let k = from; k < to; k += 1) out.push(src[k]!);
  };
  while (n >= 13 && ip <= n - 12) {
    const key =
      (src[ip]! | (src[ip + 1]! << 8) | (src[ip + 2]! << 16) | (src[ip + 3]! << 24)) >>> 0;
    const ref = seen.get(key);
    seen.set(key, ip);
    if (ref !== undefined && ip - ref < 65536) {
      let ml = 4;
      while (ip + ml < n - 5 && src[ref + ml] === src[ip + ml]) ml += 1;
      const lit = ip - anchor;
      out.push((Math.min(lit, 15) << 4) | Math.min(ml - 4, 15));
      if (lit >= 15) ext(lit - 15);
      literals(anchor, ip);
      const distance = ip - ref;
      out.push(distance & 0xff, distance >> 8);
      if (ml - 4 >= 15) ext(ml - 19);
      ip += ml;
      anchor = ip;
      continue;
    }
    ip += 1;
  }
  const lit = n - anchor;
  out.push(Math.min(lit, 15) << 4);
  if (lit >= 15) ext(lit - 15);
  literals(anchor, n);
  return Uint8Array.from(out);
}
