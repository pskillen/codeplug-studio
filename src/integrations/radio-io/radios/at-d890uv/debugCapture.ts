/** Read-only D890 debug session. Failure permanently disables the guarded finish. */
import type { BytePipe, ProgressFn } from '../../types.ts';
import { throwIfAborted } from '../../kit/progress.ts';
import { parseAnytoneDmrReadReply } from '../../kit/codecs/anytoneDmrRw.ts';
import {
  atD890EnterProgram,
  atD890ProbeIdent,
  atD890ReadMemory,
  type AtD890Ident,
} from './connection.ts';
import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';
import type { AtD890DownloadCache } from './memory.ts';
import { downloadAtD890SparseRegions } from './protocol.ts';
import {
  assertAtD890NoStunKill,
  endAtD890ReadSession,
  withAtD890ReadRecovery,
} from './stunKillGuard.ts';
import { readAtD890VitalUnits, type AtD890VitalReadResult } from './vitalBackup.ts';

export interface AtD890DebugCapture {
  cache: AtD890DownloadCache;
  ident: AtD890Ident;
  vital: AtD890VitalReadResult;
  capturedAt: string;
}

const FINISH_AUTHORITY = Symbol();

/** END is permitted only inside finish, after the helper's fresh LocalInfo check. */
export function createAtD890DebugGuard(pipe: BytePipe, signal?: AbortSignal) {
  let failed = false;
  let finishing = false;
  let ended = false;
  let pendingRead: { address: number; length: number } | undefined;
  const rememberRead = (data: Uint8Array) => {
    pendingRead = {
      address: ((data[1]! << 24) | (data[2]! << 16) | (data[3]! << 8) | data[4]!) >>> 0,
      length: data[5]!,
    };
  };
  const check = () => {
    if (signal?.aborted) failed = true;
    throwIfAborted(signal);
    if (failed || ended) throw new Error('D890 debug session is no longer usable.');
  };
  const safe: BytePipe = {
    async write(data) {
      check();
      if (finishing) {
        failed = true;
        throw new Error('D890 debug session is finishing.');
      }
      const program =
        data.length === 7 && data.every((v, i) => v === [80, 82, 79, 71, 82, 65, 77][i]);
      const ident = data.length === 1 && data[0] === 2;
      const read =
        data.length === 6 &&
        data[0] === 0x52 &&
        data[5]! >= 16 &&
        data[5]! <= 0xf0 &&
        data[5]! % 16 === 0;
      if (!(program || ident || read)) {
        failed = true;
        throw new Error('D890 debug refused a non-read command.');
      }
      if (pendingRead) {
        failed = true;
        throw new Error('D890 debug has an unanswered read.');
      }
      if (read) rememberRead(data);
      try {
        await pipe.write(data);
      } catch (error) {
        failed = true;
        throw error;
      }
    },
    async readExact(n, timeout) {
      check();
      try {
        const bytes = await pipe.readExact(n, timeout);
        check();
        if (bytes.length !== n) throw new Error('Short radio response.');
        if (pendingRead) {
          const request = pendingRead;
          pendingRead = undefined;
          parseAnytoneDmrReadReply(bytes, request.length, request.address);
        }
        return bytes;
      } catch (error) {
        failed = true;
        throw error;
      }
    },
    flush: pipe.flush
      ? async () => {
          check();
          await pipe.flush!();
        }
      : undefined,
    close: () => pipe.close(),
  };
  return {
    pipe: safe,
    abandon: () => {
      failed = true;
    },
    async finish(authority?: symbol) {
      check();
      if (authority !== FINISH_AUTHORITY) {
        failed = true;
        throw new Error('D890 debug finish is not armed.');
      }
      finishing = true;
      const finishPipe: BytePipe = {
        ...safe,
        async write(data) {
          check();
          const localRead =
            data.length === 6 &&
            data[0] === 0x52 &&
            data[1] === ((D890_MAP.LocalInfo >>> 24) & 255) &&
            data[2] === ((D890_MAP.LocalInfo >>> 16) & 255) &&
            data[3] === ((D890_MAP.LocalInfo >>> 8) & 255) &&
            data[4] === (D890_MAP.LocalInfo & 255) &&
            data[5] === AT_D890_BLOCK_SIZE;
          const end = data.length === 3 && data[0] === 69 && data[1] === 78 && data[2] === 68;
          if (!localRead && !end) {
            failed = true;
            throw new Error('D890 debug finish refused command.');
          }
          if (pendingRead) {
            failed = true;
            throw new Error('D890 debug has an unanswered read.');
          }
          if (end) ended = true;
          if (localRead) rememberRead(data);
          try {
            await pipe.write(data);
          } catch (error) {
            failed = true;
            throw error;
          }
        },
      };
      try {
        await endAtD890ReadSession(finishPipe);
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        finishing = false;
      }
    },
  };
}

export const captureAtD890DebugPipe = withAtD890ReadRecovery(
  async (
    pipe: BytePipe,
    opts?: { signal?: AbortSignal; onProgress?: ProgressFn },
  ): Promise<AtD890DebugCapture> => {
    const guard = createAtD890DebugGuard(pipe, opts?.signal);
    try {
      await atD890EnterProgram(guard.pipe, opts?.signal);
      const ident = await atD890ProbeIdent(guard.pipe, opts?.signal);
      const head = await atD890ReadMemory(
        guard.pipe,
        D890_MAP.LocalInfo,
        AT_D890_BLOCK_SIZE,
        opts?.signal,
      );
      assertAtD890NoStunKill(head);
      const cache: AtD890DownloadCache = { blocks: new Map() };
      await downloadAtD890SparseRegions(guard.pipe, cache, {
        ...opts,
        readBlockSize: AT_D890_BLOCK_SIZE,
      });
      const vital = await readAtD890VitalUnits(
        { pipe: guard.pipe, abandonProgramMode: guard.abandon, readBlockSize: AT_D890_BLOCK_SIZE },
        opts,
      );
      throwIfAborted(opts?.signal);
      await guard.finish(FINISH_AUTHORITY);
      return { cache, ident, vital, capturedAt: new Date().toISOString() };
    } catch (error) {
      guard.abandon();
      throw error;
    } finally {
      await guard.pipe.close();
    }
  },
);
