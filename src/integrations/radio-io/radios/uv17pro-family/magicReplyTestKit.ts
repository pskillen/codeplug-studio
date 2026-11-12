/** Test helper: a fake radio's reply to a handshake magic; the `M` reply starts with the model name. */
export function fakeMagicReply(
  send: Uint8Array,
  responseLen: number,
  modelReplyPrefix?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(responseLen);
  if (modelReplyPrefix && send.length === 1 && send[0] === 0x4d) out.set(modelReplyPrefix);
  return out;
}
