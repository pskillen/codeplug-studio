import { describe, expect, it } from 'vitest';
import { crc32Ieee } from '../../kit/checksums.ts';
import { RadioInterlockError } from '../../kit/errors.ts';
import type { BytePipe } from '../../types.ts';
import { BLOCK_SIZE, CODEPLUG_COMMAND, OP_INFO, PHYSICAL_CODEPLUG_BASE } from './constants.ts';
import { decodeDebugFrame, encodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import { createRadioFoundryCableProtocol } from './protocol.ts';
import {
  radioFoundryTleEpochSeconds,
  SAT_OP_ABORT,
  SAT_OP_COMMIT,
  SAT_OP_DATA,
  SAT_OP_INFO,
  SAT_OP_LIST,
  SAT_OP_PROFILE_STAGE_CHUNK,
  SAT_OP_PROFILE_VALUES_GET,
  SAT_OP_REPLACE_BEGIN,
  SATELLITE_COMMAND,
  serialiseSatelliteRecords,
  type RadioFoundrySatelliteRecord,
} from './satellite.ts';
import type { RadioFoundrySatelliteProfile } from '@core/radios/radiofoundry/satelliteCapability.ts';
import {
  probeRadioFoundrySatellites,
  RadioFoundrySatellitesUnavailableError,
  formatRadioFoundrySatelliteFrames,
  writeRadioFoundrySatellites,
  type RadioFoundrySatelliteFrame,
} from './satelliteWrite.ts';

const CODEPLUG_REPLY = CODEPLUG_COMMAND | 0x80;
const SAT_REPLY = SATELLITE_COMMAND | 0x80;

const DM32UV_VERSION_TEXT =
  'proto=1\ngit=454a5b76\ngit_time=1795365604\nsource=official\nboard=DM-32UV\nfeatures=\n';

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function infoBody(): Uint8Array {
  const body = new Uint8Array(26);
  body[0] = 1;
  body[1] = 0x02;
  body[2] = 0x00;
  body[3] = 0x10;
  body[4] = 16;
  body[5] = 61;
  body[6] = 1000 & 0xff;
  body[7] = (1000 >> 8) & 0xff;
  writeU32(body, 8, 0x10000);
  writeU32(body, 12, 0x20000);
  writeU32(body, 16, 0x800000);
  writeU32(body, 20, PHYSICAL_CODEPLUG_BASE);
  return body;
}

function tleLine1(catalog: number, epochField: string): string {
  const cat = String(catalog).padStart(5, '0');
  const line = `1 ${cat}U 98067A   ${epochField.padEnd(15).slice(0, 15)}  .00016717 00000-0  10230-3 0  9990`;
  return line;
}

function tleLine2(catalog: number): string {
  const cat = String(catalog).padStart(5, '0');
  return `2 ${cat}  51.6416 247.4627 0006703 130.5360 325.0288 15.49560319 99999`;
}

function tle(catalog: number, epoch: string) {
  return { line1: tleLine1(catalog, epoch), line2: tleLine2(catalog) };
}

function u32(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16) | (buf[off + 3]! << 24)) >>> 0;
}

function u16(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}

class FakeSatelliteRadio implements BytePipe {
  readonly ops: { command: number; op: number }[] = [];
  private pending = new Uint8Array(0);

  protocol = 7;
  capacity = 10;
  installed = 0;
  versionText = DM32UV_VERSION_TEXT;

  fixedStatus = new Map<number, number>();
  busyCounts = new Map<number, number>();
  dataBadOffset = false;
  profileStageStatus = 0;
  commitStatus = 0;
  listWrongEpoch = false;
  private committed = false;

  inventory: RadioFoundrySatelliteRecord[] = [];
  private profiles = new Map<number, RadioFoundrySatelliteProfile>();
  private txnId: number | null = null;
  private stream = new Uint8Array(0);
  private streamOffset = 0;
  private stagedProfiles: RadioFoundrySatelliteProfile[] = [];

  constructor() {
    for (let addr = 0; addr < 0x100000; addr += BLOCK_SIZE) {
      /* satisfy connect memory if needed */
    }
  }

  async write(data: Uint8Array): Promise<void> {
    const frame = decodeDebugFrame(data);
    if (frame.command === 0x02) {
      const text = new TextEncoder().encode(this.versionText);
      this.enqueue(encodeDebugFrame(0x82, frame.seq, Uint8Array.from([0, ...text])));
      return;
    }
    if (frame.command === CODEPLUG_COMMAND) {
      const op = frame.payload[0]!;
      this.ops.push({ command: CODEPLUG_COMMAND, op });
      if (op === OP_INFO) {
        this.enqueue(satPayload(0, infoBody(), frame.seq, CODEPLUG_REPLY));
      }
      return;
    }
    if (frame.command !== SATELLITE_COMMAND) return;
    const op = frame.payload[0]!;
    const args = frame.payload.subarray(1);
    this.ops.push({ command: SATELLITE_COMMAND, op });

    const busy = this.busyCounts.get(op) ?? 0;
    if (busy > 0) {
      this.busyCounts.set(op, busy - 1);
      this.enqueue(satPayload(3, new Uint8Array(0), frame.seq, SAT_REPLY));
      return;
    }

    const fixed = this.fixedStatus.get(op);
    if (fixed !== undefined) {
      this.enqueue(satPayload(fixed, new Uint8Array(0), frame.seq, SAT_REPLY));
      return;
    }

    if (op === SAT_OP_INFO) {
      const body = new Uint8Array(5);
      body[0] = this.protocol;
      body[1] = this.capacity & 0xff;
      body[2] = (this.capacity >> 8) & 0xff;
      body[3] = this.installed & 0xff;
      body[4] = (this.installed >> 8) & 0xff;
      this.enqueue(satPayload(0, body, frame.seq, SAT_REPLY));
      return;
    }

    if (op === SAT_OP_LIST) {
      const start = u16(args, 0);
      const slice = this.inventory.slice(start, start + 10);
      const body = new Uint8Array(1 + slice.length * 8);
      body[0] = slice.length;
      for (let i = 0; i < slice.length; i += 1) {
        const rec = slice[i]!;
        const off = 1 + i * 8;
        body[off] = rec.catalogId & 0xff;
        body[off + 1] = (rec.catalogId >>> 8) & 0xff;
        body[off + 2] = (rec.catalogId >>> 16) & 0xff;
        body[off + 3] = (rec.catalogId >>> 24) & 0xff;
        let epoch = radioFoundryTleEpochSeconds(rec.line1) ?? 0;
        if (this.listWrongEpoch && this.committed) epoch += 1;
        body[off + 4] = epoch & 0xff;
        body[off + 5] = (epoch >>> 8) & 0xff;
        body[off + 6] = (epoch >>> 16) & 0xff;
        body[off + 7] = (epoch >>> 24) & 0xff;
      }
      this.enqueue(satPayload(0, body, frame.seq, SAT_REPLY));
      return;
    }

    if (op === SAT_OP_REPLACE_BEGIN) {
      this.stream = new Uint8Array(0);
      this.streamOffset = 0;
      this.stagedProfiles = [];
      this.txnId = 0x0102;
      this.enqueue(
        satPayload(
          0,
          new Uint8Array([this.txnId & 0xff, (this.txnId >> 8) & 0xff]),
          frame.seq,
          SAT_REPLY,
        ),
      );
      return;
    }

    if (op === SAT_OP_DATA) {
      const off = u16(args, 2);
      const chunk = args.subarray(4);
      if (off !== this.streamOffset) {
        this.enqueue(satPayload(2, new Uint8Array(0), frame.seq, SAT_REPLY));
        return;
      }
      const next = new Uint8Array(this.stream.length + chunk.length);
      next.set(this.stream, 0);
      next.set(chunk, this.stream.length);
      this.stream = next;
      this.streamOffset = off + chunk.length;
      let nextOff = this.streamOffset;
      if (this.dataBadOffset) nextOff -= 1;
      const body = new Uint8Array(2);
      body[0] = nextOff & 0xff;
      body[1] = (nextOff >> 8) & 0xff;
      this.enqueue(satPayload(0, body, frame.seq, SAT_REPLY));
      return;
    }

    if (op === SAT_OP_PROFILE_STAGE_CHUNK) {
      if (this.profileStageStatus !== 0) {
        this.enqueue(satPayload(this.profileStageStatus, new Uint8Array(0), frame.seq, SAT_REPLY));
        return;
      }
      const count = args[4]!;
      let o = 5;
      for (let i = 0; i < count; i += 1) {
        this.stagedProfiles.push({
          catalogId: u32(args, o),
          rxHz: u32(args, o + 4),
          txHz: u32(args, o + 8),
          toneTenths: u16(args, o + 12),
        });
        o += 14;
      }
      this.enqueue(satPayload(0, new Uint8Array(0), frame.seq, SAT_REPLY));
      return;
    }

    if (op === SAT_OP_COMMIT) {
      if (this.commitStatus !== 0) {
        this.enqueue(satPayload(this.commitStatus, new Uint8Array(0), frame.seq, SAT_REPLY));
        return;
      }
      const crc = u32(args, 2);
      if (crc !== crc32Ieee(this.stream)) {
        this.enqueue(satPayload(2, new Uint8Array(0), frame.seq, SAT_REPLY));
        return;
      }
      this.inventory = parseRecordsFromStream(this.stream);
      this.installed = this.inventory.length;
      this.profiles = new Map(this.stagedProfiles.map((p) => [p.catalogId, p]));
      this.committed = true;
      this.enqueue(satPayload(0, new Uint8Array(0), frame.seq, SAT_REPLY));
      return;
    }

    if (op === SAT_OP_ABORT) {
      this.txnId = null;
      this.stream = new Uint8Array(0);
      this.enqueue(satPayload(0, new Uint8Array(0), frame.seq, SAT_REPLY));
      return;
    }

    if (op === SAT_OP_PROFILE_VALUES_GET) {
      const sorted = [...this.profiles.values()].sort((a, b) => a.catalogId - b.catalogId);
      const body = new Uint8Array(1 + sorted.length * 14);
      body[0] = sorted.length;
      let off = 1;
      for (const p of sorted) {
        body[off] = p.catalogId & 0xff;
        body[off + 1] = (p.catalogId >>> 8) & 0xff;
        body[off + 2] = (p.catalogId >>> 16) & 0xff;
        body[off + 3] = (p.catalogId >>> 24) & 0xff;
        body[off + 4] = p.rxHz & 0xff;
        body[off + 5] = (p.rxHz >>> 8) & 0xff;
        body[off + 6] = (p.rxHz >>> 16) & 0xff;
        body[off + 7] = (p.rxHz >>> 24) & 0xff;
        body[off + 8] = p.txHz & 0xff;
        body[off + 9] = (p.txHz >>> 8) & 0xff;
        body[off + 10] = (p.txHz >>> 16) & 0xff;
        body[off + 11] = (p.txHz >>> 24) & 0xff;
        body[off + 12] = p.toneTenths & 0xff;
        body[off + 13] = (p.toneTenths >> 8) & 0xff;
        off += 14;
      }
      this.enqueue(satPayload(0, body, frame.seq, SAT_REPLY));
      return;
    }

    this.enqueue(satPayload(1, new Uint8Array(0), frame.seq, SAT_REPLY));
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.pending.length < n) throw new Error('timeout');
    const out = this.pending.slice(0, n);
    this.pending = this.pending.slice(n);
    return out;
  }

  async close(): Promise<void> {}

  private enqueue(frame: Uint8Array): void {
    const next = new Uint8Array(this.pending.length + frame.length);
    next.set(this.pending, 0);
    next.set(frame, this.pending.length);
    this.pending = next;
  }
}

function satPayload(status: number, body: Uint8Array, seq: number, replyCmd: number): Uint8Array {
  const payload = new Uint8Array(1 + body.length);
  payload[0] = status;
  payload.set(body, 1);
  return encodeDebugFrame(replyCmd, seq, payload);
}

function parseRecordsFromStream(stream: Uint8Array): RadioFoundrySatelliteRecord[] {
  const out: RadioFoundrySatelliteRecord[] = [];
  let o = 0;
  while (o < stream.length) {
    const catalogId = u32(stream, o);
    const nameLen = stream[o + 4]!;
    const name = new TextDecoder().decode(stream.subarray(o + 5, o + 5 + nameLen));
    const l1 = new TextDecoder().decode(stream.subarray(o + 5 + nameLen, o + 5 + nameLen + 69));
    const l2 = new TextDecoder().decode(
      stream.subarray(o + 5 + nameLen + 69, o + 5 + nameLen + 138),
    );
    out.push({ catalogId, name, line1: l1, line2: l2 });
    o += 5 + nameLen + 138;
  }
  return out;
}

function satOps(pipe: FakeSatelliteRadio): number[] {
  return pipe.ops.filter((e) => e.command === SATELLITE_COMMAND).map((e) => e.op);
}

function twoSatellites(): {
  records: RadioFoundrySatelliteRecord[];
  profiles: RadioFoundrySatelliteProfile[];
} {
  const a = tle(43017, '24045.12345678');
  const b = tle(25544, '24045.51782528');
  const records: RadioFoundrySatelliteRecord[] = [
    { catalogId: 43017, name: 'AO-91', line1: a.line1, line2: a.line2 },
    { catalogId: 25544, name: 'ISS', line1: b.line1, line2: b.line2 },
  ];
  const profiles: RadioFoundrySatelliteProfile[] = [
    { catalogId: 43017, rxHz: 436_795_000, txHz: 145_850_000, toneTenths: 670 },
    { catalogId: 25544, rxHz: 436_795_000, txHz: 145_850_000, toneTenths: 0 },
  ];
  return { records, profiles };
}

async function connectedRadio(pipe: FakeSatelliteRadio) {
  const radio = createRadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
  await radio.connect(pipe);
  return radio;
}

describe('writeRadioFoundrySatellites', () => {
  it('replaces the set and verifies it by reading back', async () => {
    const pipe = new FakeSatelliteRadio();
    const radio = await connectedRadio(pipe);
    const { records, profiles } = twoSatellites();
    const stream = serialiseSatelliteRecords(records, 48);
    const dataChunks = Math.ceil(stream.length / 59);

    const result = await writeRadioFoundrySatellites(radio, { records, profiles });
    expect(result).toEqual({ written: 2, capacity: 10 });
    expect(satOps(pipe)).toEqual([
      SAT_OP_INFO,
      SAT_OP_REPLACE_BEGIN,
      ...Array(dataChunks).fill(SAT_OP_DATA),
      SAT_OP_PROFILE_STAGE_CHUNK,
      SAT_OP_COMMIT,
      SAT_OP_INFO,
      SAT_OP_LIST,
      SAT_OP_PROFILE_VALUES_GET,
    ]);
    expect([...pipe.inventory].sort((a, b) => a.catalogId - b.catalogId)).toEqual(
      [...records].sort((a, b) => a.catalogId - b.catalogId),
    );
  });

  it('records every SATELLITE frame and status', async () => {
    const pipe = new FakeSatelliteRadio();
    const radio = await connectedRadio(pipe);
    const frameLog: RadioFoundrySatelliteFrame[] = [];
    await writeRadioFoundrySatellites(radio, twoSatellites(), { frameLog });
    expect(frameLog.map((f) => f.op)).toEqual(satOps(pipe));
    expect(frameLog.every((f) => f.status === 0)).toBe(true);
    expect(frameLog[0]).toMatchObject({ op: SAT_OP_INFO, argsLen: 0, status: 0, bodyLen: 5 });
    expect(formatRadioFoundrySatelliteFrames(frameLog)[0]).toBe(
      '0 INFO args=0B -> status 0, body 5B',
    );
  });

  it('attaches the frame log as debugText when the read-back does not match', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.listWrongEpoch = true;
    const radio = await connectedRadio(pipe);
    const err = await writeRadioFoundrySatellites(radio, twoSatellites()).catch((e) => e);
    expect(err.debugText).toContain('SATELLITE frames sent');
    expect(err.debugText).toContain('INFO args=0B -> status 0');
    expect(err.debugText).toContain('LIST args=2B');
  });

  it('attaches the frame log when the radio refuses COMMIT', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.commitStatus = 7;
    const radio = await connectedRadio(pipe);
    const err = await writeRadioFoundrySatellites(radio, twoSatellites()).catch((e) => e);
    expect(err.debugText).toContain('4 COMMIT args=');
    expect(err.debugText).toContain('status 7');
    expect(err.debugText).toContain('5 ABORT');
  });

  it('reports an older build as unavailable', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.fixedStatus.set(SAT_OP_INFO, 1);
    const radio = await connectedRadio(pipe);
    await expect(probeRadioFoundrySatellites(radio)).resolves.toEqual({
      supported: false,
      reason: "This radio's RadioFoundry build is older than satellite support.",
    });
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toBeInstanceOf(
      RadioFoundrySatellitesUnavailableError,
    );
    expect(satOps(pipe).includes(SAT_OP_REPLACE_BEGIN)).toBe(false);
  });

  it('reports satellite tracking off', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.fixedStatus.set(SAT_OP_INFO, 4);
    pipe.versionText =
      'proto=1\ngit=454a5b76\ngit_time=1795365604\nsource=official\nboard=DM-32UV\nfeatures=\noff=SATELLITE_TLE\n';
    const radio = await connectedRadio(pipe);
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toThrow(
      "This radio's RadioFoundry build has satellite tracking switched off.",
    );
    expect(satOps(pipe).includes(SAT_OP_REPLACE_BEGIN)).toBe(false);
  });

  it('refuses satellite protocols it does not speak', async () => {
    for (const protocol of [5, 8]) {
      const pipe = new FakeSatelliteRadio();
      pipe.protocol = protocol;
      const radio = await connectedRadio(pipe);
      await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toThrow(/protocol/);
      expect(satOps(pipe).includes(SAT_OP_REPLACE_BEGIN)).toBe(false);
    }
  });

  it('refuses more satellites than the radio holds', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.capacity = 1;
    const radio = await connectedRadio(pipe);
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toThrow(
      'This radio holds 1 satellites; 2 were selected.',
    );
    expect(satOps(pipe).includes(SAT_OP_REPLACE_BEGIN)).toBe(false);
  });

  it('aborts when DATA does not advance', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.dataBadOffset = true;
    const radio = await connectedRadio(pipe);
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toThrow(
      'The radio did not accept the satellite data.',
    );
    expect(satOps(pipe).includes(SAT_OP_ABORT)).toBe(true);
    expect(satOps(pipe).includes(SAT_OP_COMMIT)).toBe(false);
  });

  it('aborts when the radio refuses the frequencies', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.profileStageStatus = 2;
    const radio = await connectedRadio(pipe);
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toThrow(
      'The radio refused the satellite frequencies.',
    );
    expect(satOps(pipe).includes(SAT_OP_ABORT)).toBe(true);
    expect(satOps(pipe).includes(SAT_OP_COMMIT)).toBe(false);
  });

  it('aborts when COMMIT is refused', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.commitStatus = 7;
    const radio = await connectedRadio(pipe);
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toThrow(
      'The radio did not commit the satellite set.',
    );
    expect(satOps(pipe).includes(SAT_OP_ABORT)).toBe(true);
  });

  it('fails when the read-back differs', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.listWrongEpoch = true;
    const radio = await connectedRadio(pipe);
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).rejects.toThrow(
      'The satellites on the radio after the write do not match what Studio sent.',
    );
    expect(satOps(pipe).filter((op) => op === SAT_OP_ABORT).length).toBe(0);
  });

  it('retries while the radio is busy', async () => {
    const pipe = new FakeSatelliteRadio();
    pipe.busyCounts.set(SAT_OP_REPLACE_BEGIN, 2);
    const radio = await connectedRadio(pipe);
    await expect(writeRadioFoundrySatellites(radio, twoSatellites())).resolves.toBeDefined();
  });

  it('checks the input before touching the radio', async () => {
    const pipe = new FakeSatelliteRadio();
    const radio = await connectedRadio(pipe);
    const { records, profiles } = twoSatellites();
    const many = Array.from({ length: 11 }, (_, i) => ({
      ...records[0]!,
      catalogId: 1000 + i,
      name: `S${i}`,
    }));
    const manyProfiles = many.map((r) => ({
      catalogId: r.catalogId,
      rxHz: 436_795_000,
      txHz: 145_850_000,
      toneTenths: 0,
    }));
    await expect(
      writeRadioFoundrySatellites(radio, { records: many, profiles: manyProfiles }),
    ).rejects.toThrow();
    await expect(
      writeRadioFoundrySatellites(radio, {
        records,
        profiles: [{ ...profiles[0]!, catalogId: 99999 }],
      }),
    ).rejects.toThrow();
    await expect(
      writeRadioFoundrySatellites(radio, { records: [], profiles: [] }),
    ).rejects.toThrow();
    expect(satOps(pipe).length).toBe(0);
  });

  it('never sends operations outside the allowlist', async () => {
    const pipe = new FakeSatelliteRadio();
    const radio = await connectedRadio(pipe);
    for (const op of [2, 6, 7, 8, 10, 13, 200]) {
      await expect(radio.satelliteRequest(op, new Uint8Array(0), 100)).rejects.toBeInstanceOf(
        RadioInterlockError,
      );
    }
    expect(pipe.ops.filter((e) => e.command === SATELLITE_COMMAND).length).toBe(0);
  });

  it('probes without writing', async () => {
    const pipe = new FakeSatelliteRadio();
    const radio = await connectedRadio(pipe);
    pipe.ops.length = 0;
    const result = await probeRadioFoundrySatellites(radio);
    expect(result).toEqual({
      supported: true,
      info: { protocol: 7, capacity: 10, installed: 0 },
    });
    expect(satOps(pipe)).toEqual([SAT_OP_INFO]);
  });
});
