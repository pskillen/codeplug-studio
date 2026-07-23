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
  openWebSerialPipe,
  RadioTimeoutError,
  RadioWrongIdentError,
  requestWebSerialPort,
  setCachedImage,
  type MemoryMap,
  type ProgressFn,
  type RadioDescriptor,
  type RadioHydrationHooks,
  type RadioSession,
  isWebSerialSupported,
  getWebSerialUnsupportedMessage,
} from '@integrations/radio-io/index.ts';
import { expandAssembledChannelsToRadioDtos } from './radioIoChannelMap.ts';

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

function isHandshakeConnectFailure(err: unknown): boolean {
  return err instanceof RadioWrongIdentError || err instanceof RadioTimeoutError;
}

function withBaudsTriedMessage(err: unknown, baudsTried: readonly number[]): Error {
  const list = baudsTried.join(', ');
  if (err instanceof Error) {
    if (err.message.includes('tried baud')) {
      return err;
    }
    const next = new Error(`${err.message} (tried baud: ${list})`);
    next.name = err.name;
    return next;
  }
  return new Error(`Radio connect failed (tried baud: ${list})`);
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

  const bauds = descriptor.baudRateFallback
    ? ([descriptor.baudRate, descriptor.baudRateFallback] as const)
    : ([descriptor.baudRate] as const);

  const port = await requestWebSerialPort(opts?.forcePortSelection ?? true);
  let pipe: Awaited<ReturnType<typeof openWebSerialPipe>> | null = null;

  for (let attempt = 0; attempt < bauds.length; attempt++) {
    if (pipe) {
      try {
        await pipe.close();
      } catch {
        /* ignore close errors before baud retry */
      }
    }
    pipe = await openWebSerialPipe(port, bauds[attempt]!);
    const radio = descriptor.protocolFactory();
    try {
      await radio.connect(pipe, { signal: opts?.signal });
      const session = createRadioSession({ descriptor, pipe, radio });
      return { session, descriptor };
    } catch (err) {
      const baudsTried = bauds.slice(0, attempt + 1);
      const canRetry =
        attempt < bauds.length - 1 && isHandshakeConnectFailure(err) && descriptor.baudRateFallback;
      if (!canRetry) {
        try {
          await pipe.close();
        } catch {
          /* ignore close errors while surfacing connect failure */
        }
        throw withBaudsTriedMessage(err, baudsTried);
      }
    }
  }

  throw new Error('Radio connect failed unexpectedly.');
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
 * Assemble build → encode into hydrated image (no serial I/O).
 * Call before opening a Web Serial session on Write so the radio is not left
 * in program mode during CPU-heavy assemble (UV-5R Mini times out quickly).
 */
export function prepareRadioWriteImage(
  build: RadioBuild,
  egress: EgressPath,
  library: LibrarySlice,
): { image: MemoryMap; warnings: string[] } {
  const hydration = getRadioCloneHydration(egress);
  if (!hydration) {
    throw new RadioWriteBlockedError('Missing radio clone hydration on this egress path.');
  }

  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  const { dtos, warnings } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
  return { image: mergeChannelsForWrite(egress, hydration, dtos), warnings };
}

function mergeChannelsForWrite(
  egress: EgressPath,
  hydration: RadioCloneHydrationBag,
  dtos: Parameters<RadioHydrationHooks['mergeChannelsIntoHydration']>[1],
): MemoryMap {
  const descriptors = descriptorsForEgress(egress);
  const descriptor = descriptors[0];
  if (!descriptor) {
    throw new Error(
      `No Web Serial radio adapter is registered for ${egress.formatId}/${egress.profileId}.`,
    );
  }
  return descriptor.hydration.mergeChannelsIntoHydration(hydration, dtos);
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
): Promise<{ warnings: string[] }> {
  const hydration = getRadioCloneHydration(egress);
  if (session.descriptor.hydrationRequiredForWrite && !hydration) {
    throw new RadioWriteBlockedError(
      'Read from the radio first so Studio can preserve unmodelled settings, then write.',
    );
  }
  const { image, warnings } = prepareRadioWriteImage(build, egress, library);
  session.descriptor.hydration.seedProtocolForUpload?.(session.radio, hydration!);
  setCachedImage(session, image);
  await session.radio.upload(image, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  return { warnings };
}

/** Upload a prepared clone image after {@link prepareRadioWriteImage} and session connect. */
export async function uploadPreparedRadioWrite(
  session: RadioSession,
  egress: EgressPath,
  image: MemoryMap,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  const hydration = getRadioCloneHydration(egress);
  if (!hydration) {
    throw new RadioWriteBlockedError('Missing radio clone hydration on this egress path.');
  }
  session.descriptor.hydration.seedProtocolForUpload?.(session.radio, hydration);
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
