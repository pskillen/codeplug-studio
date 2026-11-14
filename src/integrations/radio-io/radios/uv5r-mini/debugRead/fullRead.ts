/**
 * The UV-5R Mini debug page's full clone read: the codeplug session's handshake (ident, `F`, `M`, the read
 * cipher-select frame), then a 64-byte `R` at every address `0x0000–0xFFC0`, then `E`. Read-only by construction:
 * every frame goes through {@link Uv5rMiniReadOnlyPipe}, which refuses anything outside its allowlist, and the code
 * calls only `connect` and `readBlocks`.
 *
 * The clone `R` handler sends `0xF000` and up plain (calibration) and XORs everything below it, so the decoded image
 * applies the clone XOR below {@link UV5R_MINI_CLONE_PLAIN_FROM} only.
 */

import { reportProgress, throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe, ProgressFn } from '../../../types.ts';
import { uv17ProCrypt } from '../../uv17pro-family/crypt.ts';
import { UV5R_MINI_LAYOUT } from '../../uv17pro-family/layout.ts';
import { Uv5rMiniProtocol } from '../protocol.ts';
import { UV5R_MINI_DEBUG_END_FRAME, Uv5rMiniReadOnlyPipe } from './frameAllowlist.ts';
import { hashUv5rMiniDebugSpans, type Uv5rMiniSpanHash } from './spans.ts';

/** Bytes in a full clone read: the whole 64 KiB the clone `R` addresses. */
export const UV5R_MINI_FULL_READ_SIZE = 0x10000;

/** The clone read sends this address and above plain; below it, XOR'd. */
export const UV5R_MINI_CLONE_PLAIN_FROM = 0xf000;

const BLOCK = UV5R_MINI_LAYOUT.blockSize;
const F_FRAME = Uint8Array.of(0x46);
const M_FRAME = Uint8Array.of(0x4d);

/** The radio's answers to `F` (16 bytes) and `M` (15 bytes), as received. */
export interface Uv5rMiniDebugIdent {
  f: Uint8Array;
  m: Uint8Array;
}

export interface Uv5rMiniFullRead {
  ident: Uv5rMiniDebugIdent;
  /** The 64 KiB as the radio sent it. */
  raw: Uint8Array;
  /** {@link raw} with the clone XOR undone below `0xF000`. */
  decoded: Uint8Array;
  /** SHA-256 of each runbook span of {@link decoded}. */
  spans: Uv5rMiniSpanHash[];
}

/** Undo the clone XOR below `0xF000`; `0xF000` and up stay as sent. */
export function decodeUv5rMiniFullRead(raw: Uint8Array): Uint8Array {
  const out = raw.slice();
  const end = Math.min(raw.length, UV5R_MINI_CLONE_PLAIN_FROM);
  out.set(uv17ProCrypt(raw.subarray(0, end), UV5R_MINI_LAYOUT.defaultEncrsym), 0);
  return out;
}

/** A handshaken debug read session: read everything, then end. */
export interface Uv5rMiniDebugSession {
  ident: Uv5rMiniDebugIdent;
  readAll(opts?: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<Uv5rMiniFullRead>;
  /** Send `E` and discard whatever the radio sends back. Best effort. */
  end(): Promise<void>;
}

/**
 * Handshake on `pipe` through the read-only pipe. Throws the codeplug session's handshake errors (wrong ident,
 * timeout), so the caller's baud fallback works as it does for a Read.
 */
export async function openUv5rMiniDebugSession(
  pipe: BytePipe,
  opts: { signal?: AbortSignal; settleScale?: number } = {},
): Promise<Uv5rMiniDebugSession> {
  const guarded = new Uv5rMiniReadOnlyPipe(pipe);
  const radio = new Uv5rMiniProtocol();
  await radio.connect(guarded, { signal: opts.signal, settleScale: opts.settleScale });
  const ident: Uv5rMiniDebugIdent = {
    f: guarded.replyTo(F_FRAME) ?? new Uint8Array(0),
    m: guarded.replyTo(M_FRAME) ?? new Uint8Array(0),
  };
  guarded.forget();

  return {
    ident,
    async readAll(readOpts = {}) {
      const raw = new Uint8Array(UV5R_MINI_FULL_READ_SIZE);
      const max = UV5R_MINI_FULL_READ_SIZE / BLOCK;
      for (let i = 0; i < max; i++) {
        throwIfAborted(readOpts.signal);
        const addr = i * BLOCK;
        await radio.readBlocks([addr], { signal: readOpts.signal });
        raw.set(guarded.lastReplyTail(BLOCK), addr);
        guarded.forget();
        reportProgress(
          readOpts.onProgress,
          { cur: i + 1, max, msg: `Reading 0x${addr.toString(16).padStart(4, '0')}` },
          readOpts.signal,
        );
      }
      const decoded = decodeUv5rMiniFullRead(raw);
      return { ident, raw, decoded, spans: hashUv5rMiniDebugSpans(decoded) };
    },
    async end() {
      try {
        await guarded.write(UV5R_MINI_DEBUG_END_FRAME);
        await guarded.flush();
      } finally {
        await radio.disconnect();
      }
    },
  };
}
