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
  request: SatelliteRequestFn = (op, args, timeoutMs) =>
    radio.satelliteRequest(op, args, timeoutMs),
): Promise<RadioFoundrySatelliteSupport> {
  const { status, body } = await request(SAT_OP_INFO, new Uint8Array(0), 2000);
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

type SatelliteRequestFn = (
  op: number,
  args: Uint8Array,
  timeoutMs: number,
) => Promise<{ status: number; body: Uint8Array }>;

/** One SATELLITE request and what came back. `status` is null when the request threw (link failure). */
export interface RadioFoundrySatelliteFrame {
  op: number;
  argsLen: number;
  status: number | null;
  bodyLen: number | null;
}

const SAT_OP_NAMES: Record<number, string> = {
  [SAT_OP_INFO]: 'INFO',
  [SAT_OP_LIST]: 'LIST',
  [SAT_OP_DATA]: 'DATA',
  [SAT_OP_COMMIT]: 'COMMIT',
  [SAT_OP_ABORT]: 'ABORT',
  [SAT_OP_REPLACE_BEGIN]: 'REPLACE_BEGIN',
  [SAT_OP_PROFILE_VALUES_GET]: 'PROFILE_VALUES_GET',
  [SAT_OP_PROFILE_STAGE_CHUNK]: 'PROFILE_STAGE_CHUNK',
};

/** One line per frame: `3 DATA args=63B -> status 0, body 2B`. */
export function formatRadioFoundrySatelliteFrames(
  frames: readonly RadioFoundrySatelliteFrame[],
): string[] {
  return frames.map((f) => {
    const name = SAT_OP_NAMES[f.op] ?? 'UNKNOWN';
    const reply =
      f.status === null ? 'no reply (request failed)' : `status ${f.status}, body ${f.bodyLen}B`;
    return `${f.op} ${name} args=${f.argsLen}B -> ${reply}`;
  });
}

function recordingRequest(
  radio: RadioFoundryCableProtocol,
  into?: RadioFoundrySatelliteFrame[],
): {
  req: SatelliteRequestFn;
  frames: RadioFoundrySatelliteFrame[];
} {
  const frames: RadioFoundrySatelliteFrame[] = into ?? [];
  const req: SatelliteRequestFn = async (op, args, timeoutMs) => {
    try {
      const reply = await radio.satelliteRequest(op, args, timeoutMs);
      frames.push({ op, argsLen: args.length, status: reply.status, bodyLen: reply.body.length });
      return reply;
    } catch (err) {
      frames.push({ op, argsLen: args.length, status: null, bodyLen: null });
      throw err;
    }
  };
  return { req, frames };
}

/** Replace the radio's whole satellite set with `input`, then read it back. */
async function writeInner(
  radio: RadioFoundryCableProtocol,
  req: SatelliteRequestFn,
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
  const probe = await probeRadioFoundrySatellites(radio, req);
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
    const listReply = await req(SAT_OP_LIST, listArgs(start), 2000);
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
  const beginReply = await req(
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
      const dataReply = await req(SAT_OP_DATA, encodeDataChunk(transactionId, offset, chunk), 2000);
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
      const profReply = await req(SAT_OP_PROFILE_STAGE_CHUNK, block, 4000);
      if (profReply.status !== 0 || profReply.body.length !== 0) {
        throw new RadioProtocolError('The radio refused the satellite frequencies.');
      }
    }

    throwIfAborted(opts?.signal);
    const commitReply = await req(SAT_OP_COMMIT, encodeCommit(transactionId, crc), 10_000);
    if (commitReply.status !== 0) {
      throw new RadioProtocolError('The radio did not commit the satellite set.');
    }
  } catch (err) {
    try {
      await req(SAT_OP_ABORT, encodeTransactionId(transactionId), 2000);
    } catch {
      /* swallow */
    }
    throw err;
  }

  throwIfAborted(opts?.signal);
  const infoAfter = await req(SAT_OP_INFO, new Uint8Array(0), 2000);
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
    const listReply = await req(SAT_OP_LIST, listArgs(listIndex), 2000);
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
  const profReply = await req(SAT_OP_PROFILE_VALUES_GET, new Uint8Array(0), 2000);
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

/**
 * Replace the radio's whole satellite set, then read it back. Pass `frameLog` to receive every
 * SATELLITE request of this write (the caller owns it, one per write). On error, `debugText` on
 * the thrown error holds the same log.
 */
export async function writeRadioFoundrySatellites(
  radio: RadioFoundryCableProtocol,
  input: RadioFoundrySatelliteWriteInput,
  opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    frameLog?: RadioFoundrySatelliteFrame[];
  },
): Promise<{ written: number; capacity: number }> {
  const { req, frames } = recordingRequest(radio, opts?.frameLog);
  try {
    return await writeInner(radio, req, input, opts);
  } catch (err) {
    if (err instanceof Error && frames.length > 0) {
      (err as Error & { debugText?: string }).debugText = [
        `Satellite keps write failed: ${err.message}`,
        `SATELLITE frames sent (${frames.length}, oldest first):`,
        ...formatRadioFoundrySatelliteFrames(frames),
      ].join('\n');
    }
    throw err;
  }
}

function listArgs(start: number): Uint8Array {
  const args = new Uint8Array(2);
  args[0] = start & 0xff;
  args[1] = (start >>> 8) & 0xff;
  return args;
}
