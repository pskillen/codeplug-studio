/**
 * Thin app services for Web Serial read (EgressPath hydration) and write (assemble → encode).
 * No PROGRAM frame bytes here — integrations/radio-io owns protocol.
 */

import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { channelLocationWriteRadioNote } from '@core/radio-targets/channelLocationNotes.ts';
import {
  isAtD890RadioIoProfileId,
  isDm32RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
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
  type RadioSession,
  type SerialPortLike,
  type UsbDeviceLike,
  isCapacitorSerialSupported,
  isRadioSerialSupported,
  isWebSerialSupported,
  getRadioSerialUnsupportedMessage,
  getWebSerialUnsupportedMessage,
} from '@integrations/radio-io/index.ts';
import type { PlannedStage, RadioPlanContext } from '@integrations/radio-io/types.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import type {
  WriteVerifyCaptureResult,
  WriteVerifyPendingPayload,
  WriteVerifyResult,
} from '@integrations/radio-io/writeVerify.ts';
import {
  assembledHasNxdnChannels,
  buildRadioWriteProjection,
  type BuildRadioWriteProjectionContext,
} from './radioIoWriteProjection.ts';
import { isMm9pdyAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import { isAtD890Mm9pdyNxdnEnabled } from '@integrations/radio-io/radios/at-d890uv/mm9pdySettingsStore.ts';
import type { RadioWriteOrganisation } from '@integrations/radio-io/radioWriteProjection.ts';
import {
  collectDualBankDirectorySlice,
  type DualBankRadioWritePrepareOptions,
} from './dualBankRadioWrite.ts';
import { startAtD890WriteTiming } from './radioIoAtD890WriteTimings.ts';
import {
  declareAtD890ContactUnitsForWrite,
  prepareAtD890DigitalContactsForWrite,
  writePreparedAtD890DigitalContactsForWrite,
} from './radioIoAtD890DigitalContactWrite.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { dmrContactDigitalIdSet } from '@core/import-export/dmrContactBanks.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import {
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
} from './radioWriteEnvGate.ts';
import { encodeAtD890WriteImageFromDownloadCache } from '@integrations/radio-io/radios/at-d890uv/hydration.ts';
import {
  AT_D890_STUN_KILL_UNKNOWN_MESSAGE,
  AtD890uvProtocol,
} from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { AtD890StunKillError } from '@integrations/radio-io/radios/at-d890uv/stunKillGuard.ts';
import { encodeDm32uvWriteImageFromDownloadCache } from '@integrations/radio-io/radios/dm32uv/hydration.ts';
import { Dm32uvProtocol } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import { encodeOpenGd77WriteImageFromPrior } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import {
  OPENGD77_ZERO_DIRTY_SECTORS_MESSAGE,
  OpenGd77Protocol,
} from '@integrations/radio-io/radios/opengd77/protocol.ts';
import { Uv17ProProtocol } from '@integrations/radio-io/radios/uv17pro-family/protocol.ts';
import { Rt95Protocol } from '@integrations/radio-io/radios/rt95/protocol.ts';
import { atD890ReadMemory } from '@integrations/radio-io/radios/at-d890uv/connection.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { formatAtD890LocalInfoSerial } from '@integrations/radio-io/radios/at-d890uv/identityCheck.ts';
import {
  atD890UploadBankIntentFromOrganisation,
  alignDownAtD890Address,
  getCacheBytes,
  type AtD890DownloadCache,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { decodeAtD890MasterIdName } from '@integrations/radio-io/radios/at-d890uv/masterIdCodec.ts';
import {
  atD890LanguageLockProblem,
  languageLockFromLocalInfo,
} from '@integrations/radio-io/radios/at-d890uv/settingsCodec.ts';
import type {
  AtD890RadioSettingsSnapshot,
  AtD890SettingsOverride,
  AtD890SettingsTarget,
} from '@integrations/radio-io/radios/at-d890uv/settingsFields.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import { isOpenGd77RadioIoEgress } from './radioIoChannelMap.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

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

/** Port picker result — granted during a user gesture, opened later (Write assemble path). */
export type GrantedRadioSerialPort =
  { transport: 'web'; port: SerialPortLike } | { transport: 'capacitor'; device: UsbDeviceLike };

/**
 * Request (or reuse) a serial port without opening it or running a radio handshake.
 * Call from the Write click before CPU-heavy assemble so `requestPort()` keeps user activation.
 */
export async function grantRadioSerialPortForEgress(opts?: {
  forcePortSelection?: boolean;
}): Promise<GrantedRadioSerialPort> {
  if (isCapacitorSerialSupported()) {
    const device = await requestCapacitorSerialPort();
    return { transport: 'capacitor', device };
  }
  const port = await requestWebSerialPort(opts?.forcePortSelection ?? true);
  return { transport: 'web', port };
}

function isHandshakeConnectFailure(err: unknown): boolean {
  return err instanceof RadioWrongIdentError || err instanceof RadioTimeoutError;
}

function withBaudsTriedMessage(err: unknown, baudsTried: readonly number[]): Error {
  const list = baudsTried.join(', ');
  if (err instanceof Error) {
    // The stun/kill refusals are not connect failures: keep their class and wording (#1288).
    if (err instanceof AtD890StunKillError || err.message === AT_D890_STUN_KILL_UNKNOWN_MESSAGE) {
      return err;
    }
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
    /** When set, skip requestPort / requestPermission — use a prior {@link grantRadioSerialPortForEgress}. */
    grantedPort?: GrantedRadioSerialPort;
    /**
     * Restore opens without read handshake; restoreFromBackup supplies upload handshake.
     * Write uses the read handshake so ident runs before in-session pre-write download
     * (UV-17Pro / RT95). Assemble already finished before this open (#1247).
     */
    purpose?: 'read' | 'write' | 'restore';
    /**
     * DM-32UV backup sets this so connect reads the factory sector.
     * Write and Restore leave it unset. Other radios ignore it.
     */
    captureFactorySector?: boolean;
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
  let nativeDevice: UsbDeviceLike | null = null;
  let webPort: SerialPortLike | null = null;
  if (opts?.grantedPort) {
    if (opts.grantedPort.transport === 'capacitor') {
      nativeDevice = opts.grantedPort.device;
    } else {
      webPort = opts.grantedPort.port;
    }
  } else {
    nativeDevice = isNative ? await requestCapacitorSerialPort() : null;
    webPort = isNative ? null : await requestWebSerialPort(opts?.forcePortSelection ?? true);
  }

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
        handshake: opts?.purpose === 'restore' ? 'none' : 'read',
        ...(opts?.captureFactorySector ? { captureFactorySector: true as const } : {}),
      });
      const session = createRadioSession({ descriptor, pipe, radio });
      if (radio instanceof AtD890uvProtocol && radio.mustNotEnd()) {
        // #1288: END would clear a stun/kill flag and rewrite LocalInfo, and an unreadable LocalInfo
        // leaves the state unknown. `disconnect()` leaves without END; nothing is read or written.
        try {
          radio.assertNoStunKillFlag();
        } finally {
          await closeRadioSession(session).catch(() => undefined);
        }
      }
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

/**
 * The operator cancelled at the pause before the first `W` frame (AT-D890UV settings overrides).
 * Nothing was written; release the session as a Read-only session is released.
 */
export class RadioWriteCancelledError extends Error {
  constructor(message = 'Write cancelled before anything was sent to the radio.') {
    super(message);
    this.name = 'RadioWriteCancelledError';
  }
}

/** What the app shows at the pause: the radio's identity and settings, and what will change. */
export interface AtD890PreTransmitContext {
  /** LocalInfo serial of the connected radio. */
  serial: string;
  /** Master radio ID name as the radio holds it. */
  masterIdName: string;
  /** Settings spans from the in-session read (no extra reads). */
  snapshot: AtD890RadioSettingsSnapshot;
  overrides: readonly AtD890SettingsOverride[];
  target: AtD890SettingsTarget;
  /**
   * A copy of the in-session download cache taken at the pause, before `upload()` can touch it, so
   * Review's "Save backup now" packs what the radio held. Absent for a settings-only Write, which
   * reads only the settings.
   */
  downloadCache?: AtD890DownloadCache;
}

/** `'apply'` writes the overrides, `'keep'` writes without them, `'cancel'` stops before any frame. */
export type AtD890PreTransmitDecision = 'apply' | 'keep' | 'cancel';

/**
 * What the pause may resolve with. `'apply'` writes the overrides given when the Write started;
 * the object form writes the overrides the user ended with at the pause (Review can add some, for
 * example through the step-key nudge). Both are refused before any frame if a field is unknown,
 * duplicated or out of range.
 */
export type AtD890PreTransmitResult =
  AtD890PreTransmitDecision | { decision: 'apply'; overrides: readonly AtD890SettingsOverride[] };

/** Normalise a pause result to its decision and the overrides it applies. */
export function atD890PauseOutcome(
  result: AtD890PreTransmitResult | void,
  startOverrides: readonly AtD890SettingsOverride[],
): { decision: AtD890PreTransmitDecision; overrides: readonly AtD890SettingsOverride[] } {
  if (result === undefined) return { decision: 'keep', overrides: startOverrides };
  if (typeof result === 'string') return { decision: result, overrides: startOverrides };
  return { decision: result.decision, overrides: result.overrides };
}

/** Shown once when a Write skips NXDN because the radio does not report it enabled. */
export const ATD890_NXDN_NOT_WRITTEN_NOTICE =
  'NXDN not written: this radio does not have NXDN enabled';

/**
 * The AT-D890UV MM9PDY projection with NXDN output on. {@link prepareRadioWriteImage} builds it
 * beside the standard projection when the build has NXDN channels, because the radio is not read
 * until the upload starts; the upload keeps it only if the in-session read says NXDN is enabled.
 */
export interface AtD890NxdnWriteVariant {
  channels: readonly RadioChannelDto[];
  organisation: RadioWriteOrganisation;
  warnings: ExportWarning[];
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
    persistence?: ProjectPersistence;
    projectId?: string;
    onProgress?: ProgressFn;
  },
): Promise<{
  image?: MemoryMap;
  warnings: ExportWarning[];
  organisation: RadioWriteOrganisation;
  channels: readonly RadioChannelDto[];
  /** AT-D890UV MM9PDY with NXDN channels in the build: the projection to use if the radio has NXDN enabled. */
  nxdn?: AtD890NxdnWriteVariant;
}> {
  const descriptor = descriptorsForEgress(egress)[0];
  if (descriptor && resolveRadioWriteGate(descriptor) === 'hidden') {
    throw new RadioWriteBlockedError(resolveRadioWriteProdDisabledMessage(egress.profileId));
  }

  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });

  let projectionContext: BuildRadioWriteProjectionContext | undefined;
  const projectionWarnings: ExportWarning[] = [];
  if (opts?.dualBank) {
    const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
    const maxRadioIds = typeof limits?.maxRadioIds === 'number' ? limits.maxRadioIds : undefined;
    const maxDirectoryContacts = isOpenGd77RadioIoEgress(egress.profileId)
      ? OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX
      : isDm32RadioIoProfileId(egress.profileId)
        ? DM32UV_LIMITS.ADDRESS_BOOK_WRITE_MAX
        : typeof limits?.maxContacts === 'number'
          ? limits.maxContacts
          : undefined;
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
            // AT-D890: skip directory rows for this build's contacts, not every library contact.
            ...(isAtD890RadioIoProfileId(egress.profileId)
              ? {
                  libraryDigitalIds: dmrContactDigitalIdSet(assembled.digitalContacts),
                }
              : {}),
            warnings: projectionWarnings,
            onProgress: opts.onProgress,
          })
        : { radioIds: [], digitalContacts: [] };
    projectionContext = {
      dualBank: {
        mode: opts.dualBank.mode,
        options: opts.dualBank.options,
        directorySlice,
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
  let nxdn: AtD890NxdnWriteVariant | undefined;
  if (isMm9pdyAtD890RadioIoProfileId(egress.profileId) && assembledHasNxdnChannels(assembled)) {
    const withNxdn = buildRadioWriteProjection(assembled, build, library, egress, {
      ...projectionContext,
      atD890Nxdn: true,
    });
    nxdn = {
      channels: withNxdn.channels,
      organisation: { ...withNxdn.organisation },
      warnings: [...projectionWarnings, ...withNxdn.warnings],
    };
  }
  return {
    warnings,
    organisation,
    channels: projection.channels,
    ...(nxdn ? { nxdn } : {}),
  };
}

/**
 * Web Serial Write encode onto the in-session radio image (not persisted stash,
 * not a virgin 0xff map). Empty session prior → operator error after a download attempt.
 * RT95 restore reuses {@link Rt95Protocol.upload} — pre-write read lives here, not in upload().
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
  if (session.radio instanceof Uv17ProProtocol) {
    const prior = await session.radio.download({
      onProgress: opts?.onProgress,
      signal: opts?.signal,
      progressStage: 'Pre-write read',
    });
    try {
      return session.radio.encodeChannels(prior, prepared.channels);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RadioWriteBlockedError(message);
    }
  }
  if (session.radio instanceof Dm32uvProtocol) {
    await session.radio.download({
      onProgress: opts?.onProgress,
      signal: opts?.signal,
      progressStage: 'Pre-write read',
    });
    try {
      return encodeDm32uvWriteImageFromDownloadCache(
        session.radio.getDownloadCache(),
        prepared.channels,
        prepared.organisation,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RadioWriteBlockedError(message);
    }
  }
  if (session.radio instanceof Rt95Protocol) {
    const prior = await session.radio.download({
      onProgress: opts?.onProgress,
      signal: opts?.signal,
      progressStage: 'Pre-write read',
    });
    try {
      return session.radio.encodeChannels(prior, prepared.channels);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RadioWriteBlockedError(message);
    }
  }
  if (!prepared.image) {
    throw new RadioWriteBlockedError(
      isAtD890RadioIoProfileId(egress.profileId)
        ? 'Read this radio in the current session before Write. The AT-D890UV write encode needs the in-session download cache as its prior — it will not fall back to a blank 0xff image.'
        : 'Missing radio clone write image.',
    );
  }
  return prepared.image;
}

function openGd77WriteWarnings(session: RadioSession): ExportWarning[] {
  if (!(session.radio instanceof OpenGd77Protocol)) return [];
  const warnings: ExportWarning[] = [];
  if (session.radio.getLastDirtySectorCount() === 0) {
    pushGeneralWarning(warnings, OPENGD77_ZERO_DIRTY_SECTORS_MESSAGE);
  }
  const userDb = session.radio.getLastUserDatabaseWarning();
  if (userDb) pushGeneralWarning(warnings, userDb);
  return warnings;
}

/**
 * Write radio popup note about MM9PDY channel positions (#1383), or `null`.
 * Runs the same assemble + Write projection as Write, without contacts or a session.
 */
export function channelLocationNoteForWrite(
  build: RadioBuild,
  egress: EgressPath,
  library: LibrarySlice,
): string | null {
  if (!isAtD890RadioIoProfileId(egress.profileId) && !isDm32RadioIoProfileId(egress.profileId)) {
    return null;
  }
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  const projection = buildRadioWriteProjection(assembled, build, library, egress);
  return channelLocationWriteRadioNote(build.radioTargetId, projection.channelLocations);
}

/**
 * Assemble build → overlay onto this PROGRAM session → upload.
 */
export async function writeBuildToRadio(
  session: RadioSession,
  build: RadioBuild,
  egress: EgressPath,
  library: LibrarySlice,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<{ warnings: ExportWarning[] }> {
  const hydration = getRadioCloneHydration(egress);
  const prepared = await prepareRadioWriteImage(build, egress, library);
  session.descriptor.hydration.seedProtocolForUpload?.(
    session.radio,
    hydration ?? undefined,
    prepared.organisation,
    prepared.channels,
  );
  const image = await resolveRadioWriteImageForUpload(session, egress, prepared, opts);
  setCachedImage(session, image);
  // Pack and validate the contacts before the first W: nothing below can then fail for a reason
  // known up front, which would leave a half-written session (#1406).
  const isD890 = isAtD890RadioIoProfileId(egress.profileId);
  const contactWrite = isD890
    ? prepareAtD890DigitalContactsForWrite(prepared.organisation.digitalContacts)
    : undefined;
  declareAtD890ContactUnitsForWrite(session, contactWrite);
  await session.radio.upload(image, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  if (isD890) {
    await writePreparedAtD890DigitalContactsForWrite(session, contactWrite, opts);
  }
  return { warnings: [...prepared.warnings, ...openGd77WriteWarnings(session)] };
}

/** What Studio knows about the connected radio at the pause before transmit. */
export interface RadioWriteIdentity {
  /** Descriptor label, e.g. `Anytone AT-D890UV`. */
  model: string;
  /** Full serial where the radio reports one in the read (shown in full). */
  serial?: string;
  name?: string;
  /** Firmware where the radio reports it; unset means unknown. */
  firmware?: string;
}

/**
 * Passed to `beforeTransmit` once the in-session read is done and nothing has been sent. Radio
 * neutral: radios that need more (the AT-D890UV settings overrides, PR 1 of #1393) extend it.
 */
export interface BeforeTransmitContext {
  identity: RadioWriteIdentity;
  /** Channels in the Write projection. */
  channelCount: number;
  /** The channels this Write will send, when that differs from the prepared ones (NXDN gate). */
  channels?: readonly RadioChannelDto[];
  /** The write plan sized from the session (after the in-session read). */
  plan?: PlannedStage[];
  /**
   * True when this radio reads inside `upload()` rather than before it, so the pause has only the
   * ident (Review says "Studio reads the rest while writing").
   */
  identityOnly: boolean;
  /** AT-D890UV only: the settings spans from the in-session read, for Review and the fleet choice. */
  atD890?: AtD890PreTransmitContext;
}

/** Whether `resolveRadioWriteImageForUpload` reads the radio itself (every protocol but the generic path). */
export function writeReadsBeforeTransmit(session: RadioSession): boolean {
  const radio = session.radio;
  return (
    radio instanceof AtD890uvProtocol ||
    radio instanceof OpenGd77Protocol ||
    radio instanceof Uv17ProProtocol ||
    radio instanceof Dm32uvProtocol ||
    radio instanceof Rt95Protocol
  );
}

/** Identity from what the session already read; never sends a frame. */
export function radioWriteIdentityFromSession(session: RadioSession): RadioWriteIdentity {
  const identity: RadioWriteIdentity = { model: session.descriptor.label };
  if (session.radio instanceof AtD890uvProtocol) {
    const cache = session.radio.getDownloadCache();
    const serial = cache
      ? formatAtD890LocalInfoSerial(
          getCacheBytes(cache, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength),
        )
      : '';
    if (serial) identity.serial = serial;
    if (cache?.firmware) identity.firmware = cache.firmware;
  }
  return identity;
}

/** Context for the pause, built from the in-session download cache: no extra reads. */
function buildAtD890PreTransmitContext(
  radio: AtD890uvProtocol,
  organisation: RadioWriteOrganisation,
): AtD890PreTransmitContext {
  const cache = radio.getDownloadCache() ?? { blocks: new Map<number, Uint8Array>() };
  const localInfo = getCacheBytes(cache, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
  const masterId = getCacheBytes(cache, D890_MAP.MasterIdData, D890_MAP.MasterIdLength);
  return {
    serial: formatAtD890LocalInfoSerial(localInfo),
    masterIdName: decodeAtD890MasterIdName(masterId),
    snapshot: {
      localInfo,
      main: getCacheBytes(
        cache,
        D890_MAP.OptionalSettingsMain,
        D890_MAP.OptionalSettingsMainLength,
      ),
      ext: getCacheBytes(cache, D890_MAP.OptionalSettingsExt, D890_MAP.OptionalSettingsExtLength),
      masterId,
      bandCode: radio.getIdentBandCode(),
    },
    overrides: organisation.atD890SettingsOverrides ?? [],
    target: organisation.atD890SettingsTarget ?? 'stock',
    downloadCache: {
      ...(cache.firmware !== undefined ? { firmware: cache.firmware } : {}),
      ...(cache.modelString !== undefined ? { modelString: cache.modelString } : {}),
      blocks: new Map([...cache.blocks].map(([addr, data]) => [addr, data.slice()])),
    },
  };
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
    /** Parts being written, to size the plan handed to `beforeTransmit`. */
    parts?: RadioPlanContext['parts'];
    /**
     * Pause point (#1393): called after the in-session read and before the first frame is sent
     * (`session.radio.upload`). Resolve to transmit; reject to stop (nothing is sent). Omitted:
     * the path is unchanged. On the AT-D890UV the callback may resolve `'apply'` (write the session
     * settings overrides), `'keep'` or nothing (write without them), or `'cancel'` (stop).
     */
    beforeTransmit?: (ctx: BeforeTransmitContext) => Promise<void | AtD890PreTransmitResult>;
    /** AT-D890UV session settings overrides. Empty or unset: today's Write, byte for byte. */
    settingsOverrides?: readonly AtD890SettingsOverride[];
    /**
     * AT-D890UV MM9PDY: the projection with NXDN on, from {@link prepareRadioWriteImage}. Used only
     * when the in-session read says the radio has NXDN enabled; otherwise `channels` and
     * `organisation` are written and `warnings` gains one notice.
     */
    nxdn?: AtD890NxdnWriteVariant;
    /** Warnings of the standard projection, used with `nxdn` to build the Write's warning list. */
    warnings?: readonly ExportWarning[];
  },
): Promise<{
  writeVerifyPending?: WriteVerifyCaptureResult;
  warnings?: ExportWarning[];
  /** The projection warnings that apply to what was sent; set only when `opts.nxdn` was given. */
  projectionWarnings?: ExportWarning[];
  /** The channels sent; set only when `opts.nxdn` was given. */
  channels?: readonly RadioChannelDto[];
  /** AT-D890UV: the `[d890-write-timing]` console line (#1406), for the Done step's copy button. */
  timings?: string;
}> {
  // Per-stage timings with frame counts; the Review pause is excluded (#1406).
  const timing = startAtD890WriteTiming(session, opts?.onProgress);
  const onProgress = timing ? timing.timeline.onProgress : opts?.onProgress;
  let nxdnOutcome: { channels: readonly RadioChannelDto[]; warnings: ExportWarning[] } | undefined;
  try {
    // AT-D890UV MM9PDY: the NXDN gate is the radio's own settings-store record, so it is decided
    // here, from the in-session read, before anything is seeded, reviewed or sent.
    if (opts?.nxdn && session.radio instanceof AtD890uvProtocol) {
      let cache = session.radio.getDownloadCache();
      if (!cache || cache.blocks.size === 0) {
        await session.radio.download({ onProgress, signal: opts?.signal });
        cache = session.radio.getDownloadCache();
      }
      if (isAtD890Mm9pdyNxdnEnabled(cache)) {
        nxdnOutcome = { channels: opts.nxdn.channels, warnings: opts.nxdn.warnings };
        opts = { ...opts, channels: opts.nxdn.channels, organisation: opts.nxdn.organisation };
      } else {
        const notice: ExportWarning[] = [];
        pushGeneralWarning(notice, ATD890_NXDN_NOT_WRITTEN_NOTICE);
        nxdnOutcome = {
          channels: opts.channels ?? [],
          warnings: [...(opts.warnings ?? []), ...notice],
        };
      }
    }
    const hydration = getRadioCloneHydration(egress);
    session.descriptor.hydration.seedProtocolForUpload?.(
      session.radio,
      hydration ?? undefined,
      opts?.organisation,
      opts?.channels,
    );
    const resolved = await resolveRadioWriteImageForUpload(
      session,
      egress,
      {
        image,
        channels: opts?.channels ?? [],
        organisation: opts?.organisation ?? {},
      },
      { ...opts, onProgress },
    );
    setCachedImage(session, resolved);
    // A flagged radio is refused at open; this is the backstop before the pause and any frame.
    if (session.radio instanceof AtD890uvProtocol) session.radio.assertNoStunKillFlag();
    const overrides = opts?.settingsOverrides ?? [];
    const isAtD890 = session.radio instanceof AtD890uvProtocol;
    const withOverrides: RadioWriteOrganisation = {
      ...(opts?.organisation ?? {}),
      ...(overrides.length > 0 ? { atD890SettingsOverrides: overrides } : {}),
    };
    if (isAtD890 && overrides.length > 0) {
      // Resolve now so a refused override (unknown field, duplicate, out of range) fails before the
      // pause and before any frame.
      atD890UploadBankIntentFromOrganisation(withOverrides, opts?.channels);
    }
    // Pack and validate the contacts before the pause and before the first W (#1406).
    const isD890 = isAtD890RadioIoProfileId(egress.profileId);
    const contactWrite = isD890
      ? prepareAtD890DigitalContactsForWrite(opts?.organisation?.digitalContacts)
      : undefined;
    if (opts?.beforeTransmit) {
      timing?.timeline.markPauseStart();
      const result = await opts.beforeTransmit({
        identity: radioWriteIdentityFromSession(session),
        channelCount: opts.channels?.length ?? 0,
        identityOnly: !writeReadsBeforeTransmit(session),
        ...(nxdnOutcome ? { channels: nxdnOutcome.channels } : {}),
        plan: planForOperation(session.descriptor, 'write', {
          prepared: { channels: opts.channels ?? [], organisation: opts.organisation ?? {} },
          session,
          ...(opts.parts ? { parts: opts.parts } : {}),
        }),
        ...(session.radio instanceof AtD890uvProtocol
          ? { atD890: buildAtD890PreTransmitContext(session.radio, withOverrides) }
          : {}),
      });
      timing?.timeline.markPauseEnd();
      const outcome = atD890PauseOutcome(result, overrides);
      if (outcome.decision === 'cancel') throw new RadioWriteCancelledError();
      if (outcome.decision === 'apply' && isAtD890 && outcome.overrides.length > 0) {
        const chosen: RadioWriteOrganisation = {
          ...(opts?.organisation ?? {}),
          atD890SettingsOverrides: outcome.overrides,
        };
        // The radio re-forces its language from LocalInfo at every load: refuse one its region forbids.
        const languageCache = session.radio.getDownloadCache();
        // Fail closed: a language change with no LocalInfo in the cache cannot be checked against the lock.
        if (
          outcome.overrides.some((o) => o.fieldId === 'language') &&
          !languageCache?.blocks.has(alignDownAtD890Address(D890_MAP.LocalInfo))
        ) {
          throw new RadioWriteBlockedError(
            "Studio can't check this radio's language lock because its LocalInfo was not read; the Language change was not written.",
          );
        }
        const languageProblem = atD890LanguageLockProblem(
          outcome.overrides,
          languageLockFromLocalInfo(
            getCacheBytes(
              languageCache ?? { blocks: new Map<number, Uint8Array>() },
              D890_MAP.LocalInfo,
              D890_MAP.LocalInfoLength,
            ),
          ),
        );
        if (languageProblem) throw new RadioWriteBlockedError(languageProblem);
        // Resolve again: the overrides may have changed at the pause. Refused ones fail here, before upload.
        atD890UploadBankIntentFromOrganisation(chosen, opts?.channels);
        session.descriptor.hydration.seedProtocolForUpload?.(
          session.radio,
          hydration ?? undefined,
          chosen,
          opts?.channels,
        );
      }
    }
    declareAtD890ContactUnitsForWrite(session, contactWrite);
    await session.radio.upload(resolved, {
      onProgress,
      signal: opts?.signal,
    });
    if (isD890) {
      await writePreparedAtD890DigitalContactsForWrite(session, contactWrite, {
        ...opts,
        onProgress,
      });
    }
    const captured = session.descriptor.writeVerify?.captureAfterUpload(session);
    const warnings = openGd77WriteWarnings(session);
    const timings = timing?.finish({
      profileId: egress.profileId,
      contacts: opts?.organisation?.digitalContacts?.length ?? 0,
    });
    return {
      ...(captured ? { writeVerifyPending: captured } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(nxdnOutcome
        ? { projectionWarnings: nxdnOutcome.warnings, channels: nxdnOutcome.channels }
        : {}),
      ...(timings ? { timings } : {}),
    };
  } catch (err) {
    // A failed or cancelled Write keeps its partial timings in the console (#1406).
    timing?.finish({
      profileId: egress.profileId,
      contacts: opts?.organisation?.digitalContacts?.length ?? 0,
      outcome:
        err instanceof RadioWriteCancelledError || opts?.signal?.aborted ? 'aborted' : 'failed',
    });
    throw err;
  }
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

/** Read LocalInfo serial from a connected AT-D890UV session (Restore identity vs zip). */
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
