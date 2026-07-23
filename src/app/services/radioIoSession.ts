/**
 * Thin app services for Web Serial read (EgressPath hydration) and write (assemble → encode).
 * No PROGRAM frame bytes here — integrations/radio-io owns protocol.
 */

import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
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
import { assembledChannelsToRadioDtos } from './radioIoChannelMap.ts';

export { isWebSerialSupported, getWebSerialUnsupportedMessage };

export function descriptorsForEgress(egress: EgressPath): RadioDescriptor[] {
  return listDescriptorsForProfile(egress.formatId, egress.profileId);
}

/** @deprecated Prefer {@link descriptorsForEgress}. */
export function descriptorsForBuild(egress: EgressPath): RadioDescriptor[] {
  return descriptorsForEgress(egress);
}

export function egressHasRadioCloneHydration(egress: EgressPath): boolean {
  return isRadioCloneHydrationBag(egress.hydration);
}

/** @deprecated Prefer {@link egressHasRadioCloneHydration}. */
export const buildHasRadioCloneHydration = egressHasRadioCloneHydration;

export function getRadioCloneHydration(egress: EgressPath): RadioCloneHydrationBag | null {
  return isRadioCloneHydrationBag(egress.hydration) ? egress.hydration : null;
}

export interface OpenRadioSessionResult {
  session: RadioSession;
  descriptor: RadioDescriptor;
}

/** Open Web Serial for the first compatible descriptor (or explicit modelId). */
export async function openRadioSessionForEgress(
  egress: EgressPath,
  opts?: { modelId?: string; forcePortSelection?: boolean; signal?: AbortSignal },
): Promise<OpenRadioSessionResult> {
  const candidates = descriptorsForEgress(egress);
  if (candidates.length === 0) {
    throw new Error(
      `No Web Serial radio adapter is registered for ${egress.formatId}/${egress.profileId}.`,
    );
  }
  const descriptor =
    (opts?.modelId ? candidates.find((d) => d.modelIds.includes(opts.modelId!)) : undefined) ??
    candidates[0]!;
  const pipe = await requestWebSerialPipe({
    baudRate: descriptor.baudRate,
    forceSelection: opts?.forcePortSelection ?? true,
  });
  const radio = descriptor.protocolFactory();
  try {
    await radio.connect(pipe, { signal: opts?.signal });
  } catch (err) {
    try {
      await pipe.close();
    } catch {
      /* ignore close errors while surfacing connect failure */
    }
    throw err;
  }
  const session = createRadioSession({ descriptor, pipe, radio });
  return { session, descriptor };
}

/** @deprecated Prefer {@link openRadioSessionForEgress}. */
export async function openRadioSessionForBuild(
  egress: EgressPath,
  opts?: { modelId?: string; forcePortSelection?: boolean; signal?: AbortSignal },
): Promise<OpenRadioSessionResult> {
  return openRadioSessionForEgress(egress, opts);
}

export interface ReadRadioHydrationResult {
  hydration: RadioCloneHydrationBag;
  firmware?: string;
  channelCountOccupied: number;
}

/**
 * Download clone image and return egress hydration bag (does not mutate library).
 * Uses {@link RadioDescriptor.hydration} — no per-radio imports in this module.
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

  const modelId = session.descriptor.modelIds[0] ?? 'radio';
  const hydration = session.descriptor.hydration.extractHydration(image, {
    sourceFileName: `web-serial:${modelId}`,
    protocol: session.radio,
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
 * Requires radio-clone hydration on the egress when descriptor.hydrationRequiredForWrite.
 */
export async function writeBuildToRadio(
  session: RadioSession,
  build: RadioBuild,
  egress: EgressPath,
  library: LibrarySlice,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  const hydration = getRadioCloneHydration(egress);
  if (session.descriptor.hydrationRequiredForWrite && !hydration) {
    throw new RadioWriteBlockedError(
      'Read from the radio first so Studio can preserve unmodelled settings, then write.',
    );
  }
  if (!hydration) {
    throw new RadioWriteBlockedError('Missing radio clone hydration on this egress path.');
  }

  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  const dtos = assembledChannelsToRadioDtos(assembled.channels, build, egress);
  const image = session.descriptor.hydration.mergeChannelsIntoHydration(hydration, dtos);
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
