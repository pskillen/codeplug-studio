/**
 * Thin app services for Web Serial read (FormatBuild hydration) and write (assemble → encode).
 * No PROGRAM frame bytes here — integrations/radio-io owns protocol.
 */

import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Library } from '@core/models/library.ts';
import { assemble } from '@core/services/assemble.ts';
import {
  isRadioCloneHydrationBag,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import {
  createRadioSession,
  listDescriptorsForProfile,
  requestWebSerialPipe,
  setCachedImage,
  type ProgressFn,
  type RadioDescriptor,
  type RadioSession,
  isWebSerialSupported,
  getWebSerialUnsupportedMessage,
} from '@integrations/radio-io/index.ts';
import {
  extractUv5rMiniHydration,
  mergeChannelsIntoUv5rMiniHydration,
  UV5R_MINI_MODEL_ID,
} from '@integrations/radio-io/radios/uv5r-mini/index.ts';
import { assembledChannelsToRadioDtos } from './radioIoChannelMap.ts';

export { isWebSerialSupported, getWebSerialUnsupportedMessage };

export function descriptorsForBuild(build: FormatBuild): RadioDescriptor[] {
  return listDescriptorsForProfile(build.formatId, build.profileId);
}

export function buildHasRadioCloneHydration(build: FormatBuild): boolean {
  return isRadioCloneHydrationBag(build.cpsWireHydration);
}

export function getRadioCloneHydration(build: FormatBuild): RadioCloneHydrationBag | null {
  return isRadioCloneHydrationBag(build.cpsWireHydration) ? build.cpsWireHydration : null;
}

export interface OpenRadioSessionResult {
  session: RadioSession;
  descriptor: RadioDescriptor;
}

/** Open Web Serial for the first compatible descriptor (or explicit modelId). */
export async function openRadioSessionForBuild(
  build: FormatBuild,
  opts?: { modelId?: string; forcePortSelection?: boolean; signal?: AbortSignal },
): Promise<OpenRadioSessionResult> {
  const candidates = descriptorsForBuild(build);
  if (candidates.length === 0) {
    throw new Error(
      `No Web Serial radio adapter is registered for ${build.formatId}/${build.profileId}.`,
    );
  }
  const descriptor =
    (opts?.modelId
      ? candidates.find((d) => d.modelIds.includes(opts.modelId!))
      : undefined) ?? candidates[0]!;
  const pipe = await requestWebSerialPipe({
    baudRate: descriptor.baudRate,
    forceSelection: opts?.forcePortSelection ?? true,
  });
  const radio = descriptor.protocolFactory();
  await radio.connect(pipe, { signal: opts?.signal });
  const session = createRadioSession({ descriptor, pipe, radio });
  return { session, descriptor };
}

export interface ReadRadioHydrationResult {
  hydration: RadioCloneHydrationBag;
  firmware?: string;
  channelCountOccupied: number;
}

/**
 * Download clone image and return FormatBuild hydration bag (does not mutate library).
 */
export async function readRadioHydrationForBuild(
  session: RadioSession,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<ReadRadioHydrationResult> {
  const image = await session.radio.download({
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  setCachedImage(session, image);
  const firmware = session.radio.readFirmware(image);
  const channels = session.radio.decodeChannels(image);
  const occupied = channels.filter((c) => !c.empty).length;

  const modelId = session.descriptor.modelIds.includes(UV5R_MINI_MODEL_ID)
    ? UV5R_MINI_MODEL_ID
    : (session.descriptor.modelIds[0] ?? UV5R_MINI_MODEL_ID);
  const hydration = extractUv5rMiniHydration(image, {
    sourceFileName: `web-serial:${modelId}`,
  });

  return {
    hydration,
    firmware: firmware ?? hydration.retain.firmware,
    channelCountOccupied: occupied,
  };
}

export class RadioWriteBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadioWriteBlockedError';
  }
}

/**
 * Assemble build → encode into hydrated image → upload.
 * Requires radio-clone hydration when descriptor.hydrationRequiredForWrite.
 */
export async function writeBuildToRadio(
  session: RadioSession,
  build: FormatBuild,
  library: Library,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  const hydration = getRadioCloneHydration(build);
  if (session.descriptor.hydrationRequiredForWrite && !hydration) {
    throw new RadioWriteBlockedError(
      'Read from the radio first so Studio can preserve unmodelled settings, then write.',
    );
  }
  if (!hydration) {
    throw new RadioWriteBlockedError('Missing radio clone hydration on this format build.');
  }

  const assembled = assemble(build, library);
  const dtos = assembledChannelsToRadioDtos(assembled.channels);
  const image = mergeChannelsIntoUv5rMiniHydration(hydration, dtos);
  setCachedImage(session, image);
  await session.radio.upload(image, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
}

export async function closeRadioSession(session: RadioSession): Promise<void> {
  try {
    await session.radio.disconnect();
  } finally {
    await session.pipe.close();
  }
}
