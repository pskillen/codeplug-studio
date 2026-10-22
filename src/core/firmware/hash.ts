import { bytesToHex } from './hex.ts';

/** SHA-256 of `bytes` as lowercase hex (Web Crypto). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a plain ArrayBuffer-backed view: avoids the ArrayBufferLike / BufferSource typing mismatch.
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return bytesToHex(new Uint8Array(digest));
}
