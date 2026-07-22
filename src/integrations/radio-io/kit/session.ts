import type {
  BytePipe,
  CloneImageRadio,
  MemoryMap,
  RadioDescriptor,
  RadioSession,
} from '../types.ts';

export interface CreateRadioSessionInput {
  descriptor: RadioDescriptor;
  pipe: BytePipe;
  radio: CloneImageRadio;
  cachedImage?: MemoryMap;
}

/** Build a RadioSession shell — does not open ports or call radio.connect. */
export function createRadioSession(input: CreateRadioSessionInput): RadioSession {
  return {
    descriptor: input.descriptor,
    pipe: input.pipe,
    radio: input.radio,
    cachedImage: input.cachedImage,
  };
}

/** Cache a downloaded/assembled image on the session (FT / UV5R settings survival). */
export function setCachedImage(session: RadioSession, image: MemoryMap): void {
  session.cachedImage = image;
}

/** Drop the cached image (e.g. after disconnect or failed upload). */
export function clearCachedImage(session: RadioSession): void {
  session.cachedImage = undefined;
}
