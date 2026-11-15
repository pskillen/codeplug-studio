import { describe, expect, it } from 'vitest';
import { AtD890ScriptedPipe, scriptAtD890Connect } from './__fixtures__/scriptedPipe.ts';
import { D890_MAP } from './constants.ts';
import { AT_D890_PENDING_UNITS_KEY } from './pendingUnits.ts';
import {
  AT_D890_PROBE,
  listAtD890ProbeSentinels,
  makeAtD890ProbeSentinel,
} from './eraseUnitProbe.ts';
import {
  runAtD890ConfigAliasCheck,
  runAtD890LinkProbe,
  runAtD890ProbeDiagnose,
  runAtD890ProbeInspect,
  runAtD890ProbeMeasure,
  runAtD890ProbePaint,
  runAtD890ProbeVerifyAndMark,
} from './eraseUnitProbeRunner.ts';
import {
  runAtD890DigitalContactsDump,
  runAtD890MemoryDumpAll,
  runAtD890MemoryGroupDump,
  runAtD890MemoryRegionDump,
  runAtD890WriteVerifyMemoryRead,
} from './memoryRegionExport.ts';

const sentinelAddresses = new Set(listAtD890ProbeSentinels().map(({ address }) => address));
const isLocalInfo = (address: number) =>
  address >= D890_MAP.LocalInfo && address < D890_MAP.LocalInfo + D890_MAP.LocalInfoLength;

/** A synthetic radio with inspectable frames and deterministic error injection. */
class MatrixPipe extends AtD890ScriptedPipe {
  readonly readAddresses: number[] = [];
  failAt: number | undefined;
  failFrom: number | undefined;
  measure = false;
  flagAt: number | undefined;
  abortAt: number | undefined;
  controller = new AbortController();

  constructor() {
    super();
    scriptAtD890Connect(this);
    this.autoAckWrites = true;
    this.readResponder = (address, length) => {
      const index = this.readAddresses.length - 1;
      if (index === this.failAt || (this.failFrom !== undefined && index >= this.failFrom))
        return null;
      const data = new Uint8Array(length);
      if (index === this.flagAt) data[0] = 1;
      if (address === D890_MAP.DigitalContactMeta && length >= 8) {
        const view = new DataView(data.buffer);
        view.setUint32(0, 2, true);
        view.setUint32(4, D890_MAP.DigitalContactData + 32, true);
      }
      if (length === 16 && sentinelAddresses.has(address)) {
        if (
          this.measure &&
          Math.floor(address / 0x2000) === Math.floor(AT_D890_PROBE.MARKER_ADDRESS / 0x2000)
        )
          return data.fill(0xff);
        return makeAtD890ProbeSentinel(address);
      }
      return data;
    };
  }

  override async write(frame: Uint8Array): Promise<void> {
    if (frame[0] === 0x52 && frame.length >= 6) {
      this.readAddresses.push(
        ((frame[1]! << 24) | (frame[2]! << 16) | (frame[3]! << 8) | frame[4]!) >>> 0,
      );
    }
    await super.write(frame);
  }

  override async readExact(length: number, timeoutMs: number): Promise<Uint8Array> {
    const bytes = await super.readExact(length, timeoutMs);
    if (this.readAddresses.length - 1 === this.abortAt && length > 16) this.controller.abort();
    return bytes;
  }
}

const hasEnd = (pipe: MatrixPipe) =>
  pipe.writes.some(
    (frame) => frame.length === 3 && frame[0] === 0x45 && frame[1] === 0x4e && frame[2] === 0x44,
  );

interface Entry {
  name: string;
  write: boolean;
  run: (pipe: MatrixPipe) => Promise<unknown>;
}
const opts = (pipe: MatrixPipe) => ({ signal: pipe.controller.signal });
const entries: Entry[] = [
  {
    name: 'region dump',
    write: false,
    run: (p) => runAtD890MemoryRegionDump(p, 'channelSet', opts(p)),
  },
  { name: 'all dump', write: false, run: (p) => runAtD890MemoryDumpAll(p, opts(p)) },
  { name: 'group dump', write: false, run: (p) => runAtD890MemoryGroupDump(p, 'airband', opts(p)) },
  {
    name: 'write-verify read',
    write: false,
    run: (p) => runAtD890WriteVerifyMemoryRead(p, [D890_MAP.ChannelSet], opts(p)),
  },
  { name: 'contacts dump', write: false, run: (p) => runAtD890DigitalContactsDump(p, opts(p)) },
  { name: 'inspect', write: false, run: (p) => runAtD890ProbeInspect(p, opts(p)) },
  { name: 'diagnose', write: false, run: (p) => runAtD890ProbeDiagnose(p, opts(p)) },
  { name: 'link', write: false, run: (p) => runAtD890LinkProbe(p, opts(p)) },
  { name: 'measure', write: false, run: (p) => runAtD890ProbeMeasure(p, opts(p)) },
  { name: 'alias', write: false, run: (p) => runAtD890ConfigAliasCheck(p, opts(p)) },
  { name: 'paint', write: true, run: (p) => runAtD890ProbePaint(p, opts(p)) },
  { name: 'verify and mark', write: true, run: (p) => runAtD890ProbeVerifyAndMark(p, opts(p)) },
];

async function run(entry: Entry, pipe: MatrixPipe): Promise<unknown> {
  pipe.measure = entry.name === 'measure';
  try {
    return await entry.run(pipe);
  } finally {
    // Refusal after a synthetic write deliberately leaves a pending-session marker.
    localStorage.removeItem(AT_D890_PENDING_UNITS_KEY);
  }
}

describe('debug entry-point END safety matrix', () => {
  it.each(entries)(
    '$name: zero, flagged, unread, read failure, and abort',
    async (entry) => {
      const healthy = new MatrixPipe();
      await run(entry, healthy);
      expect(hasEnd(healthy), 'known-zero flags send END').toBe(true);
      const flagIndex = entry.write ? 0 : healthy.readAddresses.length - 1;
      expect(healthy.readAddresses[flagIndex], 'flag check targets LocalInfo').toBe(
        D890_MAP.LocalInfo,
      );
      if (entry.write)
        expect(healthy.writes.some((frame) => frame[0] === 0x57 && frame.length === 24)).toBe(true);
      const nonLocalIndices = healthy.readAddresses.flatMap((address, index) =>
        isLocalInfo(address) ? [] : [index],
      );
      expect(nonLocalIndices.length).toBeGreaterThan(1);

      const flagged = new MatrixPipe();
      flagged.flagAt = flagIndex;
      await expect(run(entry, flagged)).rejects.toThrow(/power-cycle/i);
      expect(hasEnd(flagged), 'flagged flags refuse END').toBe(false);

      const unread = new MatrixPipe();
      unread.failAt = flagIndex;
      await expect(run(entry, unread)).rejects.toThrow(/power-cycle/i);
      expect(hasEnd(unread), 'unread flags refuse END').toBe(false);

      const failed = new MatrixPipe();
      failed.failFrom = nonLocalIndices[1];
      await expect(run(entry, failed)).rejects.toThrow(/power-cycle/i);
      expect(hasEnd(failed), 'mid-read failure skips END').toBe(false);

      const aborted = new MatrixPipe();
      aborted.abortAt = nonLocalIndices[0];
      await expect(run(entry, aborted)).rejects.toThrow(/power-cycle/i);
      expect(aborted.controller.signal.aborted).toBe(true);
      expect(hasEnd(aborted), 'mid-read abort skips END').toBe(false);
    },
    180_000,
  );
});
