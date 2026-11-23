import { RADIOFOUNDRY_LIMITS } from '@core/radios/radiofoundry/limits.ts';
import type { RadioFoundrySatelliteProfile } from '@core/radios/radiofoundry/satelliteCapability.ts';
import { crc32Ieee } from '../../kit/checksums.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { ProgressFn } from '../../types.ts';
import type { RadioFoundryCableProtocol } from './protocol.ts';
import {
  encodeCommit,
  encodeDataChunk,
  encodeProfileChunks,
  encodeReplaceBegin,
  encodeTransactionId,
  parseProfileValues,
  parseSatelliteInfo,
  parseSatelliteList,
  radioFoundryTleEpochSeconds,
  SAT_DATA_CHUNK_MAX,
  SAT_OP_ABORT,
  SAT_OP_COMMIT,
  SAT_OP_DATA,
  SAT_OP_INFO,
  SAT_OP_LIST,
  SAT_OP_PROFILE_STAGE_CHUNK,
  SAT_OP_PROFILE_VALUES_GET,
  SAT_OP_REPLACE_BEGIN,
  SAT_PROTOCOL_VERSIONS,
  serialiseSatelliteRecords,
  type RadioFoundrySatelliteInfo,
  type RadioFoundrySatelliteRecord,
} from './satellite.ts';

/** The radio cannot take satellites: an older build, satellite tracking off, or no satellite storage. */
export class RadioFoundrySatellitesUnavailableError extends RadioProtocolError {}

export type RadioFoundrySatelliteSupport =
  { supported: true; info: RadioFoundrySatelliteInfo } | { supported: false; reason: string };

/** INFO probe. Never throws on a status; throws only on a link failure. */
export async function probeRadioFoundrySatellites(
  radio: RadioFoundryCableProtocol,
): Promise<RadioFoundrySatelliteSupport> {
  const { status, body } = await radio.satelliteRequest(SAT_OP_INFO, new Uint8Array(0), 2000);
  if (status === 1) {
    return {
      supported: false,
      reason: "This radio's RadioFoundry build is older than satellite support.",
    };
  }
  if (status === 4) {
    const off = radio.firmwareVersion()?.off ?? [];
    if (off.includes('SATELLITE_TLE')) {
      return {
        supported: false,
        reason: "This radio's RadioFoundry build has satellite tracking switched off.",
      };
    }
    return {
      supported: false,
      reason:
        "This radio's RadioFoundry build has no satellite storage, or satellite tracking is off.",
    };
  }
  if (status !== 0) {
    return { supported: false, reason: `Satellite check failed (status ${status}).` };
  }
  const info = parseSatelliteInfo(body);
  if (!SAT_PROTOCOL_VERSIONS.includes(info.protocol)) {
    return {
      supported: false,
      reason: `This radio speaks satellite protocol ${info.protocol}; Studio supports ${SAT_PROTOCOL_VERSIONS.join(' and ')}.`,
    };
  }
  if (info.capacity === 0 || info.installed > info.capacity) {
    return {
      supported: false,
      reason: 'This radio reported an invalid satellite capacity.',
    };
  }
  return { supported: true, info };
}

export interface RadioFoundrySatelliteWriteInput {
  records: readonly RadioFoundrySatelliteRecord[];
  /** One per record, same catalog numbers. */
  profiles: readonly RadioFoundrySatelliteProfile[];
}

export const RADIOFOUNDRY_SATELLITE_STAGE = 'Satellite keps';

/** Replace the radio's whole satellite set with `input`, then read it back. */
export async function writeRadioFoundrySatellites(
  radio: RadioFoundryCableProtocol,
  input: RadioFoundrySatelliteWriteInput,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<{ written: number; capacity: number }> {
  throwIfAborted(opts?.signal);
  const { records, profiles } = input;
  if (records.length === 0) {
    throw new RadioProtocolError('RadioFoundry satellite write needs at least one record.');
  }
  if (profiles.length !== records.length) {
    throw new RadioProtocolError('RadioFoundry satellite profiles must match the records.');
  }
  const recordIds = new Set(records.map((r) => r.catalogId));
  const profileIds = new Set(profiles.map((p) => p.catalogId));
  if (recordIds.size !== records.length || profileIds.size !== profiles.length) {
    throw new RadioProtocolError('RadioFoundry satellite catalog numbers must be unique.');
  }
  for (const id of recordIds) {
    if (!profileIds.has(id)) {
      throw new RadioProtocolError('RadioFoundry satellite profiles must match the records.');
    }
  }
  if (records.length > RADIOFOUNDRY_LIMITS.SATELLITE_MAX) {
    throw new RadioProtocolError(
      `RadioFoundry holds at most ${RADIOFOUNDRY_LIMITS.SATELLITE_MAX} satellites.`,
    );
  }

  throwIfAborted(opts?.signal);
  const probe = await probeRadioFoundrySatellites(radio);
  if (!probe.supported) {
    throw new RadioFoundrySatellitesUnavailableError(probe.reason);
  }
  const info = probe.info;
  if (records.length > info.capacity) {
    throw new RadioProtocolError(
      `This radio holds ${info.capacity} satellites; ${records.length} were selected.`,
    );
  }

  throwIfAborted(opts?.signal);
  let listed = 0;
  let start = 0;
  while (listed < info.installed) {
    const listReply = await radio.satelliteRequest(SAT_OP_LIST, listArgs(start), 2000);
    throwIfAborted(opts?.signal);
    if (listReply.status !== 0) {
      throw new RadioProtocolError("The radio's satellite list did not match its own count.");
    }
    const page = parseSatelliteList(listReply.body);
    if (page.length === 0) {
      throw new RadioProtocolError("The radio's satellite list did not match its own count.");
    }
    listed += page.length;
    if (listed > info.installed) {
      throw new RadioProtocolError("The radio's satellite list did not match its own count.");
    }
    start = listed;
  }

  const stream = serialiseSatelliteRecords(records, RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES);
  const crc = crc32Ieee(stream);

  throwIfAborted(opts?.signal);
  const beginReply = await radio.satelliteRequest(
    SAT_OP_REPLACE_BEGIN,
    encodeReplaceBegin(records.length, stream.length, crc),
    4000,
  );
  if (beginReply.status !== 0) {
    throw new RadioProtocolError(
      `The radio refused the satellite set (status ${beginReply.status}).`,
    );
  }
  if (beginReply.body.length !== 2) {
    throw new RadioProtocolError('The radio refused the satellite set (status 2).');
  }
  const transactionId = beginReply.body[0]! | (beginReply.body[1]! << 8);

  try {
    let offset = 0;
    while (offset < stream.length) {
      throwIfAborted(opts?.signal);
      const chunk = stream.subarray(offset, Math.min(stream.length, offset + SAT_DATA_CHUNK_MAX));
      const dataReply = await radio.satelliteRequest(
        SAT_OP_DATA,
        encodeDataChunk(transactionId, offset, chunk),
        2000,
      );
      if (dataReply.status !== 0) {
        throw new RadioProtocolError('The radio did not accept the satellite data.');
      }
      const nextOffset =
        dataReply.body.length >= 2 ? dataReply.body[0]! | (dataReply.body[1]! << 8) : -1;
      if (nextOffset !== offset + chunk.length) {
        throw new RadioProtocolError('The radio did not accept the satellite data.');
      }
      reportProgress(
        opts?.onProgress,
        {
          cur: offset + chunk.length,
          max: stream.length,
          stage: RADIOFOUNDRY_SATELLITE_STAGE,
          msg: 'Writing satellites',
        },
        opts?.signal,
      );
      offset += chunk.length;
    }

    const profileBlocks = encodeProfileChunks(transactionId, profiles);
    for (const block of profileBlocks) {
      throwIfAborted(opts?.signal);
      const profReply = await radio.satelliteRequest(SAT_OP_PROFILE_STAGE_CHUNK, block, 4000);
      if (profReply.status !== 0 || profReply.body.length !== 0) {
        throw new RadioProtocolError('The radio refused the satellite frequencies.');
      }
    }

    throwIfAborted(opts?.signal);
    const commitReply = await radio.satelliteRequest(
      SAT_OP_COMMIT,
      encodeCommit(transactionId, crc),
      10_000,
    );
    if (commitReply.status !== 0) {
      throw new RadioProtocolError('The radio did not commit the satellite set.');
    }
  } catch (err) {
    try {
      await radio.satelliteRequest(SAT_OP_ABORT, encodeTransactionId(transactionId), 2000);
    } catch {
      /* swallow */
    }
    throw err;
  }

  throwIfAborted(opts?.signal);
  const infoAfter = await radio.satelliteRequest(SAT_OP_INFO, new Uint8Array(0), 2000);
  if (infoAfter.status !== 0) {
    throw new RadioProtocolError(
      'The satellites on the radio after the write do not match what Studio sent.',
    );
  }
  const afterInfo = parseSatelliteInfo(infoAfter.body);
  if (afterInfo.capacity !== info.capacity || afterInfo.installed !== records.length) {
    throw new RadioProtocolError(
      'The satellites on the radio after the write do not match what Studio sent.',
    );
  }

  const expectedEpochs = new Map(
    records.map((r) => [r.catalogId, radioFoundryTleEpochSeconds(r.line1)] as const),
  );
  const readEpochs = new Map<number, number>();
  let listIndex = 0;
  while (listIndex < records.length) {
    throwIfAborted(opts?.signal);
    const listReply = await radio.satelliteRequest(SAT_OP_LIST, listArgs(listIndex), 2000);
    if (listReply.status !== 0) {
      throw new RadioProtocolError(
        'The satellites on the radio after the write do not match what Studio sent.',
      );
    }
    const page = parseSatelliteList(listReply.body);
    for (const entry of page) {
      readEpochs.set(entry.catalogId, entry.epoch);
    }
    listIndex += page.length;
  }
  for (const [catalog, epoch] of expectedEpochs) {
    if (readEpochs.get(catalog) !== epoch) {
      throw new RadioProtocolError(
        'The satellites on the radio after the write do not match what Studio sent.',
      );
    }
  }

  throwIfAborted(opts?.signal);
  const profReply = await radio.satelliteRequest(
    SAT_OP_PROFILE_VALUES_GET,
    new Uint8Array(0),
    2000,
  );
  if (profReply.status !== 0) {
    throw new RadioProtocolError(
      'The satellites on the radio after the write do not match what Studio sent.',
    );
  }
  const readProfiles = parseProfileValues(profReply.body);
  const sortedExpected = [...profiles].sort((a, b) => a.catalogId - b.catalogId);
  if (readProfiles.length !== sortedExpected.length) {
    throw new RadioProtocolError(
      'The satellites on the radio after the write do not match what Studio sent.',
    );
  }
  for (let i = 0; i < sortedExpected.length; i += 1) {
    const a = readProfiles[i]!;
    const b = sortedExpected[i]!;
    if (
      a.catalogId !== b.catalogId ||
      a.rxHz !== b.rxHz ||
      a.txHz !== b.txHz ||
      a.toneTenths !== b.toneTenths
    ) {
      throw new RadioProtocolError(
        'The satellites on the radio after the write do not match what Studio sent.',
      );
    }
  }

  return { written: records.length, capacity: info.capacity };
}

function listArgs(start: number): Uint8Array {
  const args = new Uint8Array(2);
  args[0] = start & 0xff;
  args[1] = (start >>> 8) & 0xff;
  return args;
}
