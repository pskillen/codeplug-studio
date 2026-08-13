/**
 * Thin app services for Web Serial read (EgressPath hydration) and write (assemble → encode).
 * No PROGRAM frame bytes here — integrations/radio-io owns protocol.
 */

import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { resolveAtD890ScanListTiming } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import {
  isRadioCloneHydrationBag,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import {
  createRadioSession,
  listDescriptorsForProfile,
  openCapacitorSerialPipe,
  openWebSerialPipe,
  RadioTimeoutError,
  RadioWrongIdentError,
  requestCapacitorSerialPort,
  requestWebSerialPort,
  setCachedImage,
  type BytePipe,
  type MemoryMap,
  type ProgressFn,
  type RadioDescriptor,
  type RadioHydrationHooks,
  type RadioSession,
  isCapacitorSerialSupported,
  isRadioSerialSupported,
  isWebSerialSupported,
  getRadioSerialUnsupportedMessage,
  getWebSerialUnsupportedMessage,
} from '@integrations/radio-io/index.ts';
import type {
  WriteVerifyCaptureResult,
  WriteVerifyPendingPayload,
  WriteVerifyResult,
} from '@integrations/radio-io/writeVerify.ts';
import {
  buildRadioWriteProjection,
  type BuildRadioWriteProjectionContext,
} from './radioIoWriteProjection.ts';
import type { RadioWriteOrganisation } from '@integrations/radio-io/radioWriteProjection.ts';
import {
  collectDualBankDirectorySlice,
  type DualBankRadioWritePrepareOptions,
} from './dualBankRadioWrite.ts';
import {
  collectSingleBankDigitalContacts,
  type SingleBankRadioWritePrepareOptions,
} from './singleBankRadioWrite.ts';
import { uploadAtD890DigitalContactsForWrite } from './radioIoAtD890DigitalContactWrite.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { ProjectedDigitalContactRow } from '@core/domain/digitalIdDirectoryProjection.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import {
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
} from './radioWriteEnvGate.ts';
import { encodeAtD890WriteImageFromDownloadCache } from '@integrations/radio-io/radios/at-d890uv/hydration.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { encodeOpenGd77WriteImageFromPrior } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { OpenGd77Protocol } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import { atD890ReadMemory } from '@integrations/radio-io/radios/at-d890uv/connection.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { formatAtD890LocalInfoSerial } from '@integrations/radio-io/radios/at-d890uv/identityCheck.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';

export {
  isRadioSerialSupported,
  isWebSerialSupported,
  getRadioSerialUnsupportedMessage,
  getWebSerialUnsupportedMessage,
};

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
  opts?: {
    modelId?: string;
    forcePortSelection?: boolean;
    signal?: AbortSignal;
    /** Write opens the port without read handshake; upload supplies upload handshake. */
    purpose?: 'read' | 'write';
  },
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

  const isNative = isCapacitorSerialSupported();
  const nativeDevice = isNative ? await requestCapacitorSerialPort() : null;
  const webPort = isNative ? null : await requestWebSerialPort(opts?.forcePortSelection ?? true);

  let pipe: BytePipe | null = null;

  for (let attempt = 0; attempt < bauds.length; attempt++) {
    if (pipe) {
      try {
        await pipe.close();
      } catch {
        /* ignore close errors before baud retry */
      }
    }

    if (isNative && nativeDevice) {
      pipe = await openCapacitorSerialPipe(nativeDevice, bauds[attempt]!);
    } else if (webPort) {
      pipe = await openWebSerialPipe(webPort, bauds[attempt]!);
    } else {
      throw new Error('No available serial transport found.');
    }

    const radio = descriptor.protocolFactory();
    try {
      await radio.connect(pipe, {
        signal: opts?.signal,
        handshake: opts?.purpose === 'write' ? 'none' : 'read',
      });
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

/** Structured capacity info for a blocked write — lets the UI format design-exact copy (§9). */
export interface RadioWriteBlockedCapacity {
  /** Count the operator selected/enabled. */
  selected: number;
  /** The radio's hard cap for this record type. */
  max: number;
  /** Human label for the target radio, e.g. `descriptor.label`. */
  radioLabel: string;
}

export class RadioWriteBlockedError extends Error {
  /** Present when the block reason is a cardinality overage (#859 §9) — absent otherwise. */
  readonly capacity?: RadioWriteBlockedCapacity;

  constructor(message: string, capacity?: RadioWriteBlockedCapacity) {
    super(message);
    this.name = 'RadioWriteBlockedError';
    this.capacity = capacity;
  }
}

/**
 * Assemble build → encode into hydrated image (no serial I/O).
 * Call before opening a Web Serial session on Write so the radio is not left
 * in program mode during CPU-heavy assemble (UV-5R Mini times out quickly).
 */
export async function prepareRadioWriteImage(
  build: RadioBuild,
  egress: EgressPath,
  library: LibrarySlice,
  opts?: {
    dualBank?: DualBankRadioWritePrepareOptions;
    singleBank?: SingleBankRadioWritePrepareOptions;
    persistence?: ProjectPersistence;
    projectId?: string;
  },
): Promise<{
  image?: MemoryMap;
  warnings: string[];
  organisation: RadioWriteOrganisation;
  channels: readonly RadioChannelDto[];
}> {
  const descriptor = descriptorsForEgress(egress)[0];
  if (descriptor && resolveRadioWriteGate(descriptor) === 'hidden') {
    throw new RadioWriteBlockedError(resolveRadioWriteProdDisabledMessage(egress.profileId));
  }

  const hydration = getRadioCloneHydration(egress);
  if (descriptor?.hydrationRequiredForWrite && !hydration) {
    throw new RadioWriteBlockedError('Missing radio clone hydration on this egress path.');
  }

  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });

  let projectionContext: BuildRadioWriteProjectionContext | undefined;
  const projectionWarnings: string[] = [];
  if (opts?.dualBank) {
    const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
    const maxRadioIds = typeof limits?.maxRadioIds === 'number' ? limits.maxRadioIds : undefined;
    const maxDirectoryContacts =
      typeof limits?.maxContacts === 'number' ? limits.maxContacts : undefined;
    const directorySlice =
      opts.persistence && opts.projectId
        ? await collectDualBankDirectorySlice({
            store: opts.persistence,
            projectId: opts.projectId,
            library,
            egressProfileId: egress.profileId,
            options: opts.dualBank.options,
            maxRadioIds,
            maxDirectoryContacts,
            warnings: projectionWarnings,
          })
        : { radioIds: [], digitalContacts: [] };
    projectionContext = {
      dualBank: {
        mode: opts.dualBank.mode,
        options: opts.dualBank.options,
        directorySlice,
      },
    };
  } else if (opts?.singleBank && egress.profileId === 'radio-io-at-d890uv') {
    const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
    const maxContacts =
      typeof limits?.maxContacts === 'number'
        ? limits.maxContacts
        : AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX;
    const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
    const reserved = new Set<string>();
    const nameLen = AT_D890UV_LIMITS.NAME_LENGTH;
    const digitalContacts =
      opts.persistence && opts.projectId
        ? await collectSingleBankDigitalContacts({
            store: opts.persistence,
            projectId: opts.projectId,
            assembled,
            projectionMode: opts.singleBank.projectionMode,
            maxContacts,
            warnings: projectionWarnings,
            mapLibraryRow: (row) => {
              const wireName = applyListWireNameLimits(
                row.wireName,
                reserved,
                merged,
                egress.profileId,
                projectionWarnings,
                'Contact',
                nameLen,
                Boolean(row.wireNameOverride?.trim()),
              );
              return {
                digitalId: row.entity.digitalId,
                wireName,
                callsign: row.entity.callsign ?? '',
                city: row.entity.city ?? '',
                province: row.entity.state ?? '',
                country: row.entity.country ?? '',
                remark: row.entity.remarks ?? '',
              } satisfies ProjectedDigitalContactRow;
            },
          })
        : undefined;
    projectionContext = {
      singleBank: {
        mode: opts.singleBank.mode,
        projectionMode: opts.singleBank.projectionMode,
        digitalContacts,
      },
    };
  }

  const projection = buildRadioWriteProjection(
    assembled,
    build,
    library,
    egress,
    projectionContext,
  );
  const warnings = [...projectionWarnings, ...projection.warnings];
  const organisation: RadioWriteOrganisation = { ...projection.organisation };
  if (build.radioTargetId === 'anytone-at-d890uv') {
    organisation.atD890ScanListTiming = resolveAtD890ScanListTiming(
      build.exportSettings,
    ).deciseconds;
  }
  if (descriptor && !descriptor.hydrationRequiredForWrite) {
    return {
      warnings,
      organisation,
      channels: projection.channels,
    };
  }
  if (!hydration) {
    throw new RadioWriteBlockedError('Missing radio clone hydration on this egress path.');
  }
  return {
    image: mergeChannelsForWrite(egress, hydration, projection.channels, organisation),
    warnings,
    organisation,
    channels: projection.channels,
  };
}

function mergeChannelsForWrite(
  egress: EgressPath,
  hydration: RadioCloneHydrationBag,
  dtos: Parameters<RadioHydrationHooks['mergeChannelsIntoHydration']>[1],
  organisation?: RadioWriteOrganisation,
): MemoryMap {
  const descriptors = descriptorsForEgress(egress);
  const descriptor = descriptors[0];
  if (!descriptor) {
    throw new Error(
      `No Web Serial radio adapter is registered for ${egress.formatId}/${egress.profileId}.`,
    );
  }
  return descriptor.hydration.mergeChannelsIntoHydration(hydration, dtos, organisation);
}

/**
 * D890 and OpenGD77 Write encode onto the in-session radio image (not persisted stash,
 * not a virgin 0xff map). Other radios still use the image prepared from hydration.
 * Empty session prior → operator error after a download attempt.
 */
async function resolveRadioWriteImageForUpload(
  session: RadioSession,
  egress: EgressPath,
  prepared: {
    image?: MemoryMap;
    channels: readonly RadioChannelDto[];
    organisation: RadioWriteOrganisation;
  },
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<MemoryMap> {
  if (session.radio instanceof AtD890uvProtocol) {
    let cache = session.radio.getDownloadCache();
    if (!cache || cache.blocks.size === 0) {
      await session.radio.download({
        onProgress: opts?.onProgress,
        signal: opts?.signal,
      });
      cache = session.radio.getDownloadCache();
    }
    try {
      return encodeAtD890WriteImageFromDownloadCache(
        cache,
        prepared.channels,
        prepared.organisation,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RadioWriteBlockedError(message);
    }
  }
  if (session.radio instanceof OpenGd77Protocol) {
    session.radio.armWriteProjection(prepared.channels, prepared.organisation);
    let prior = session.radio.getPriorImage();
    if (!prior) {
      await session.radio.download({
        onProgress: opts?.onProgress,
        signal: opts?.signal,
        progressStage: 'Pre-write read',
      });
      prior = session.radio.getPriorImage();
    }
    try {
      return encodeOpenGd77WriteImageFromPrior(prior, prepared.channels, prepared.organisation, {
        powerSteps: session.radio.getPowerSteps(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RadioWriteBlockedError(message);
    }
  }
  if (!prepared.image) {
    throw new RadioWriteBlockedError(
      egress.profileId === 'radio-io-at-d890uv'
        ? 'Read this radio in the current session before Write. The AT-D890UV write encode needs the in-session download cache as its prior — it will not fall back to a blank 0xff image.'
        : 'Missing radio clone write image.',
    );
  }
  return prepared.image;
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
  const prepared = await prepareRadioWriteImage(build, egress, library);
  if (hydration || !session.descriptor.hydrationRequiredForWrite) {
    session.descriptor.hydration.seedProtocolForUpload?.(
      session.radio,
      hydration!,
      prepared.organisation,
    );
  }
  const image = await resolveRadioWriteImageForUpload(session, egress, prepared, opts);
  setCachedImage(session, image);
  await session.radio.upload(image, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  if (egress.profileId === 'radio-io-at-d890uv') {
    await uploadAtD890DigitalContactsForWrite(session, prepared.organisation.digitalContacts, opts);
  }
  return { warnings: prepared.warnings };
}

/** Upload a prepared clone image after {@link prepareRadioWriteImage} and session connect. */
export async function uploadPreparedRadioWrite(
  session: RadioSession,
  egress: EgressPath,
  image: MemoryMap | undefined,
  opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    organisation?: RadioWriteOrganisation;
    channels?: readonly RadioChannelDto[];
  },
): Promise<{ writeVerifyPending?: WriteVerifyCaptureResult }> {
  const hydration = getRadioCloneHydration(egress);
  if (session.descriptor.hydrationRequiredForWrite && !hydration) {
    throw new RadioWriteBlockedError('Missing radio clone hydration on this egress path.');
  }
  if (hydration || !session.descriptor.hydrationRequiredForWrite) {
    session.descriptor.hydration.seedProtocolForUpload?.(
      session.radio,
      hydration!,
      opts?.organisation,
    );
  }
  const resolved = await resolveRadioWriteImageForUpload(
    session,
    egress,
    {
      image,
      channels: opts?.channels ?? [],
      organisation: opts?.organisation ?? {},
    },
    opts,
  );
  setCachedImage(session, resolved);
  await session.radio.upload(resolved, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  if (egress.profileId === 'radio-io-at-d890uv') {
    await uploadAtD890DigitalContactsForWrite(session, opts?.organisation?.digitalContacts, opts);
  }
  const captured = session.descriptor.writeVerify?.captureAfterUpload(session);
  return captured ? { writeVerifyPending: captured } : {};
}

/** Cross-session write verify — delegates to descriptor {@link WriteVerifyHooks}. */
export async function verifyRadioWrite(
  session: RadioSession,
  pending: WriteVerifyPendingPayload,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<WriteVerifyResult> {
  const hooks = session.descriptor.writeVerify;
  if (!hooks) {
    throw new Error(`Write verify is not supported for ${session.descriptor.label}.`);
  }
  return hooks.runVerify(session, pending, opts);
}

export async function closeRadioSession(session: RadioSession): Promise<void> {
  try {
    await session.radio.disconnect();
  } finally {
    await session.pipe.close();
  }
}

/** Read LocalInfo serial from a connected AT-D890UV session (operator confirm before Write). */
export async function readAtD890ConnectedRadioIdentity(
  session: RadioSession,
  opts?: { signal?: AbortSignal },
): Promise<{ serial: string; localInfo: Uint8Array }> {
  if (!(session.radio instanceof AtD890uvProtocol)) {
    throw new Error('Connected radio is not an AT-D890UV protocol instance.');
  }
  const raw = await atD890ReadMemory(
    session.pipe,
    D890_MAP.LocalInfo,
    D890_MAP.LocalInfoLength,
    opts?.signal,
    session.radio.getNegotiatedReadBlockSize(),
  );
  return { serial: formatAtD890LocalInfoSerial(raw), localInfo: raw };
}
