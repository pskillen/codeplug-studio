import { describe, expect, it } from 'vitest';
import { newDigitalContact, newOwnDigitalId } from '@core/domain/factories.ts';
import { CONTACT_BASE } from '@core/import-export/formats/radiofoundry/layout.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { crc32Ieee } from '../../kit/checksums.ts';
import { RadioTimeoutError } from '../../kit/errors.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { expectEventsFollowPlan, stageRecorder } from '../../plannedStagesTestKit.ts';
import type { BytePipe } from '../../types.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  DM32_RADIOFOUNDRY_IMAGE_SIZE,
  FMT_BLANK,
  FMT_LZ4,
  HANDSHAKE_ERROR,
  MODE_DIRECT,
  OP_BEGIN,
  OP_BLOCK,
  OP_COMMIT,
  OP_DATA,
  OP_END,
  OP_INFO,
  OP_READ,
  OP_SUMS,
  PHYSICAL_CODEPLUG_BASE,
  servedBlockAddresses,
} from './constants.ts';
import { decodeDebugFrame, encodeDebugFrame } from './frame.ts';
import { decodeBlock, encodeBlock } from './lz4.ts';
import { planDm32RadioFoundryStages } from './plannedStages.ts';
import {
  DMR_ID_DATABASE_ADDRESS,
  DMR_ID_DATABASE_AREA1_RECORDS,
  DMR_ID_DATABASE_AREA2_ADDRESS,
  DMR_ID_DATABASE_IMAGE_END,
  DMR_ID_DATABASE_RECORD_BYTES,
} from './idDatabase.ts';
import { Dm32uvRadioFoundryProtocol } from './protocol.ts';
import {
  radioFoundryWriteSourceFromAssembled,
  type Dm32RadioFoundryWriteSource,
} from './writeSource.ts';

const REPLY = CODEPLUG_COMMAND | 0x80;

class ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  readonly beginModes: number[] = [];
  readonly blockAddresses: number[] = [];
  private pending = new Uint8Array(0);
  private blocks = new Map<number, Uint8Array>();
  private open: {
    addr: number;
    format: number;
    length: number;
    crc: number;
    stream: number[];
  } | null = null;
  infoStatus = 0;
  silent = false;

  constructor(fill: number) {
    for (const addr of servedBlockAddresses()) {
      const block = new Uint8Array(BLOCK_SIZE);
      block.fill(fill);
      this.blocks.set(addr, block);
    }
  }

  block(addr: number): Uint8Array {
    const found = this.blocks.get(addr);
    if (found) return found;
    if (addr >= DMR_ID_DATABASE_AREA2_ADDRESS && addr + BLOCK_SIZE <= DMR_ID_DATABASE_IMAGE_END) {
      const block = new Uint8Array(BLOCK_SIZE);
      block.fill(0xff);
      this.blocks.set(addr, block);
      return block;
    }
    throw new Error(`no block ${addr.toString(16)}`);
  }

  async write(data: Uint8Array): Promise<void> {
    const copy = data.slice();
    this.writes.push(copy);
    if (this.silent) return;
    const request = decodeDebugFrame(copy);
    expect(request.command).toBe(CODEPLUG_COMMAND);
    const op = request.payload[0]!;
    const args = request.payload.subarray(1);
    let status = op === OP_INFO ? this.infoStatus : 0;
    let body: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
    if (status === 0) {
      if (op === OP_INFO) body = infoBody();
      else if (op === OP_SUMS) body = this.sums(args);
      else if (op === OP_READ) body = this.read(args);
      else if (op === OP_BEGIN) {
        this.beginModes.push(args[0]!);
        body = Uint8Array.of(0, 0);
      } else if (op === OP_BLOCK) this.blockOpen(args);
      else if (op === OP_DATA) body = this.data(args);
      else if (op === OP_END) status = this.end();
      else if (op === OP_COMMIT) body = new Uint8Array(0);
      else status = 2;
    }
    const payload = new Uint8Array(1 + (status === 0 ? body.length : status === 7 ? 1 : 0));
    payload[0] = status;
    if (status === 0) payload.set(body, 1);
    if (status === 7) payload[1] = 7;
    this.enqueue(encodeDebugFrame(REPLY, request.seq, payload));
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.pending.length < n) throw new RadioTimeoutError();
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

  private sums(args: Uint8Array): Uint8Array {
    const start = u32(args, 0);
    const count = args[4]!;
    this.blockAddresses.push(start);
    const body = new Uint8Array(7 + count * 4);
    writeU32(body, 0, start);
    body[4] = count;
    let mask = 0;
    for (let j = 0; j < count; j += 1) {
      const block = this.block(start + j * BLOCK_SIZE);
      if (isBlank(block)) mask |= 1 << j;
      writeU32(body, 7 + j * 4, crc32Ieee(block));
    }
    body[5] = mask & 0xff;
    body[6] = (mask >> 8) & 0xff;
    return body;
  }

  private read(args: Uint8Array): Uint8Array {
    const addr = u32(args, 0);
    const offset = args[4]! | (args[5]! << 8);
    this.blockAddresses.push(addr);
    const block = this.block(addr);
    const blank = isBlank(block);
    const stream = blank ? new Uint8Array(0) : encodeBlock(block);
    const chunk = stream.subarray(offset, Math.min(stream.length, offset + 1000));
    // 13 field bytes, one unused pad, then the LZ4 stream. A parser that
    // starts the stream at byte 13 fails the non-blank round-trip below.
    const body = new Uint8Array(14 + chunk.length);
    writeU32(body, 0, addr);
    body[4] = blank ? FMT_BLANK : FMT_LZ4;
    body[5] = stream.length & 0xff;
    body[6] = (stream.length >> 8) & 0xff;
    writeU32(body, 7, crc32Ieee(block));
    body[11] = offset & 0xff;
    body[12] = (offset >> 8) & 0xff;
    body.set(chunk, 14);
    return body;
  }

  private blockOpen(args: Uint8Array): void {
    const addr = u32(args, 0);
    this.blockAddresses.push(addr);
    this.open = {
      addr,
      format: args[4]!,
      length: args[5]! | (args[6]! << 8),
      crc: u32(args, 7),
      stream: [],
    };
  }

  private data(args: Uint8Array): Uint8Array {
    if (!this.open) throw new Error('DATA without BLOCK');
    const offset = args[0]! | (args[1]! << 8);
    if (offset !== this.open.stream.length) throw new Error('DATA gap');
    for (let i = 2; i < args.length; i += 1) this.open.stream.push(args[i]!);
    const received = this.open.stream.length;
    return Uint8Array.of(received & 0xff, (received >> 8) & 0xff);
  }

  private end(): number {
    if (!this.open) return 7;
    const { addr, format, length, crc, stream } = this.open;
    this.open = null;
    if (format === FMT_BLANK) {
      const blank = new Uint8Array(BLOCK_SIZE);
      blank.fill(0xff);
      if (crc32Ieee(blank) !== crc) return 7;
      this.blocks.set(addr, blank);
      return 0;
    }
    if (stream.length !== length) return 7;
    const data = decodeBlock(Uint8Array.from(stream), BLOCK_SIZE);
    if (crc32Ieee(data) !== crc) return 7;
    this.blocks.set(addr, data);
    return 0;
  }
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

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function u32(source: Uint8Array, offset: number): number {
  return (
    (source[offset]! |
      (source[offset + 1]! << 8) |
      (source[offset + 2]! << 16) |
      (source[offset + 3]! << 24)) >>>
    0
  );
}

function isBlank(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i += 1) if (block[i] !== 0xff) return false;
  return true;
}

function requestOps(pipe: ScriptedPipe): number[] {
  return pipe.writes.map((frame) => decodeDebugFrame(frame).payload[0]!);
}

function requestCommands(pipe: ScriptedPipe): number[] {
  return pipe.writes.map((frame) => decodeDebugFrame(frame).command);
}

describe('DM-32 RadioFoundry fast codeplug', () => {
  it('does not offer 0x700000 as a block address', () => {
    for (const addr of servedBlockAddresses()) {
      expect(addr).toBeLessThan(PHYSICAL_CODEPLUG_BASE);
      expect(addr).not.toBe(PHYSICAL_CODEPLUG_BASE);
    }
    expect(crc32Ieee(Uint8Array.from({ length: BLOCK_SIZE }, () => 0xff))).toBe(0xf154670a);
  });

  it('stops when INFO does not answer', async () => {
    const silent = new ScriptedPipe(0xff);
    silent.silent = true;
    const missing = new Dm32uvRadioFoundryProtocol();
    await expect(missing.connect(silent)).rejects.toThrow(HANDSHAKE_ERROR);

    const refused = new ScriptedPipe(0xff);
    refused.infoStatus = 4;
    const unavailable = new Dm32uvRadioFoundryProtocol();
    await expect(unavailable.connect(refused)).rejects.toThrow(
      /did not answer the RadioFoundry codeplug protocol/,
    );
    expect(requestCommands(refused).every((command) => command === CODEPLUG_COMMAND)).toBe(true);
  });

  it('writes changed blocks, keeps unowned bytes, and commits without rebooting', async () => {
    const pipe = new ScriptedPipe(0x5a);
    const proto = new Dm32uvRadioFoundryProtocol();
    await proto.connect(pipe);

    const bytes = new Uint8Array(DM32_RADIOFOUNDRY_IMAGE_SIZE);
    bytes.fill(0xff);
    const owned = new Uint8Array(DM32_RADIOFOUNDRY_IMAGE_SIZE);
    bytes[0x00e0] = 0x54;
    owned[0x00e0] = 1;
    bytes[0x00e8] = 0xff;
    owned[0x00e8] = 1;
    const tail = 0xae000;
    bytes[tail + 0x10] = 0x11;
    owned[tail + 0x10] = 1;
    proto.armWriteSource({ bytes, owned, warnings: [] });

    const rec = stageRecorder();
    await proto.download({ progressStage: 'Pre-write read', onProgress: rec.onProgress });
    await proto.upload(memoryMapFromBytes(bytes), { onProgress: rec.onProgress });

    expect(pipe.beginModes).toEqual([MODE_DIRECT]);
    const blockOps = pipe.writes
      .map((frame) => decodeDebugFrame(frame))
      .filter((frame) => frame.payload[0] === OP_BLOCK);
    expect(blockOps).toHaveLength(2);
    expect(blockOps.map((frame) => u32(frame.payload, 1)).sort((a, b) => a - b)).toEqual([0, tail]);
    const written = pipe.block(0);
    expect(written[0]).toBe(0x5a);
    expect(written[0x00e0]).toBe(0x54);
    expect(written[0x00e8]).toBe(0xff);
    expect(pipe.block(0x1000)[0]).toBe(0x5a);
    const tailBlock = pipe.block(tail);
    expect(tailBlock[0x10]).toBe(0x11);
    expect(tailBlock[0xaee60 - tail]).toBe(0x5a);

    const ops = requestOps(pipe);
    expect(ops).toContain(OP_COMMIT);
    expect(ops.indexOf(OP_BEGIN)).toBeLessThan(ops.indexOf(OP_BLOCK));
    expect(ops.indexOf(OP_BLOCK)).toBeLessThan(ops.indexOf(OP_END));
    expect(ops.indexOf(OP_END)).toBeLessThan(ops.indexOf(OP_COMMIT));
    expect(requestCommands(pipe).every((command) => command === CODEPLUG_COMMAND)).toBe(true);
    for (const addr of pipe.blockAddresses) {
      expect(addr).not.toBe(PHYSICAL_CODEPLUG_BASE);
      expect(addr).toBeLessThan(PHYSICAL_CODEPLUG_BASE);
      expect(addr).toBeLessThan(DM32_RADIOFOUNDRY_IMAGE_SIZE);
    }
    expect(requestCommands(pipe)).not.toContain(0x0d);

    expectEventsFollowPlan(planDm32RadioFoundryStages('write', {}), rec.events);
    expect(rec.stages).toEqual(['Pre-write read', 'Codeplug blocks', 'Commit']);
  });
});

function cableAssembled(contactName?: string): AssembledBuild {
  const digitalContacts = contactName
    ? [
        {
          entity: {
            ...newDigitalContact('p', contactName, 1001, 'dmr'),
            callsign: 'M7ABC',
          },
          wireName: contactName,
        },
      ]
    : [];
  return {
    buildId: 'b',
    formatId: 'radiofoundry',
    profileId: 'radiofoundry-dm32uv',
    buildName: 'DM-32',
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts,
    analogContacts: [],
    rxGroupLists: [],
    ownDigitalIds: [{ ...newOwnDigitalId('p', 'dmr', 'MM9PDY', 2_351_234), isDefault: true }],
  };
}

function writtenBlockAddresses(pipe: ScriptedPipe): number[] {
  return pipe.writes
    .map((frame) => decodeDebugFrame(frame))
    .filter((frame) => frame.payload[0] === OP_BLOCK)
    .map((frame) => u32(frame.payload, 1));
}

function covers(addr: number, target: number): boolean {
  return addr <= target && target < addr + BLOCK_SIZE;
}

async function uploadSource(
  pipe: ScriptedPipe,
  source: Dm32RadioFoundryWriteSource,
): Promise<ReturnType<typeof stageRecorder>> {
  const proto = new Dm32uvRadioFoundryProtocol();
  await proto.connect(pipe);
  proto.armWriteSource(source);
  const rec = stageRecorder();
  await proto.download({ progressStage: 'Pre-write read', onProgress: rec.onProgress });
  await proto.upload(memoryMapFromBytes(source.bytes), { onProgress: rec.onProgress });
  return rec;
}

describe('DM-32 RadioFoundry contacts and DMR ID database', () => {
  it('writes a BLOCK covering the contact table when the radio slot is empty', async () => {
    const source = radioFoundryWriteSourceFromAssembled(cableAssembled('Alice'), {
      includeLibraryContacts: true,
    });
    const pipe = new ScriptedPipe(0xff);
    await uploadSource(pipe, source);
    const written = writtenBlockAddresses(pipe);
    expect(written.some((addr) => covers(addr, CONTACT_BASE))).toBe(true);
    const block = CONTACT_BASE & ~(BLOCK_SIZE - 1);
    expect(pipe.block(block)[CONTACT_BASE - block]).toBe('A'.charCodeAt(0));
    expect(written).not.toContain(PHYSICAL_CODEPLUG_BASE);
  });

  it('says no contact blocks changed when the contact table already matches', async () => {
    const source = radioFoundryWriteSourceFromAssembled(cableAssembled('Alice'), {
      includeLibraryContacts: true,
    });
    const pipe = new ScriptedPipe(0xff);
    const block = CONTACT_BASE & ~(BLOCK_SIZE - 1);
    const radio = pipe.block(block);
    for (let i = 0; i < BLOCK_SIZE && block + i < source.bytes.length; i += 1) {
      if (source.owned[block + i]) radio[i] = source.bytes[block + i]!;
    }
    const rec = await uploadSource(pipe, source);
    expect(writtenBlockAddresses(pipe).some((addr) => covers(addr, CONTACT_BASE))).toBe(false);
    expect(rec.events.some((event) => event.msg === 'No contact blocks changed')).toBe(true);
  });

  it('does not clear the contact table when library contacts are off', async () => {
    const source = radioFoundryWriteSourceFromAssembled(cableAssembled('Alice'), {
      includeLibraryContacts: false,
    });
    expect(source.owned[CONTACT_BASE]).toBe(0);
    const pipe = new ScriptedPipe(0x5a);
    await uploadSource(pipe, source);
    const block = CONTACT_BASE & ~(BLOCK_SIZE - 1);
    expect(writtenBlockAddresses(pipe).some((addr) => covers(addr, CONTACT_BASE))).toBe(false);
    expect(pipe.block(block)[CONTACT_BASE - block]).toBe(0x5a);
  });

  it('writes one directory row at 0x50000 and leaves that address alone when the directory is off', async () => {
    const row = {
      wireName: 'Ada',
      digitalId: 123456,
      callsign: 'M7ABC',
      city: '',
      province: '',
      country: '',
      remark: '',
    };
    const on = radioFoundryWriteSourceFromAssembled(cableAssembled(), {
      includeLibraryContacts: false,
      directoryRows: [row],
    });
    expect(on.owned[DMR_ID_DATABASE_ADDRESS]).toBe(1);
    expect(on.owned[DMR_ID_DATABASE_ADDRESS + 12 + 27]).toBe(0);
    const pipe = new ScriptedPipe(0xff);
    await uploadSource(pipe, on);
    expect(writtenBlockAddresses(pipe)).toContain(DMR_ID_DATABASE_ADDRESS);
    const block = pipe.block(DMR_ID_DATABASE_ADDRESS);
    expect(block[0]).toBe(0x49);
    expect(block[1]).toBe(0x64);
    expect(block[2]).toBe(0x4e);
    expect(block[3]).toBe(0x65);
    expect(block[8]).toBe(1);
    expect([block[12], block[13], block[14]]).toEqual([0x40, 0xe2, 0x01]);

    const off = radioFoundryWriteSourceFromAssembled(cableAssembled(), {
      includeLibraryContacts: false,
    });
    expect(off.owned[DMR_ID_DATABASE_ADDRESS]).toBe(0);
    const quiet = new ScriptedPipe(0xff);
    await uploadSource(quiet, off);
    expect(writtenBlockAddresses(quiet)).not.toContain(DMR_ID_DATABASE_ADDRESS);
    expect(writtenBlockAddresses(quiet)).not.toContain(DMR_ID_DATABASE_AREA2_ADDRESS);
    expect(writtenBlockAddresses(quiet)).not.toContain(PHYSICAL_CODEPLUG_BASE);
  });

  it('writes the overflow at 0xD8000 and stops before the native codeplug', async () => {
    const rows = Array.from({ length: DMR_ID_DATABASE_AREA1_RECORDS + 1 }, (_, index) => ({
      wireName: 'N',
      digitalId: index + 1,
      callsign: 'N',
      city: '',
      province: '',
      country: '',
      remark: '',
    }));
    const source = radioFoundryWriteSourceFromAssembled(cableAssembled(), {
      includeLibraryContacts: false,
      directoryRows: rows,
    });
    expect(source.area2?.length).toBe(DMR_ID_DATABASE_RECORD_BYTES);
    const pipe = new ScriptedPipe(0xff);
    await uploadSource(pipe, source);
    const written = writtenBlockAddresses(pipe);
    expect(written).toContain(DMR_ID_DATABASE_ADDRESS);
    expect(written).toContain(DMR_ID_DATABASE_AREA2_ADDRESS);
    expect(written.some((addr) => addr >= DMR_ID_DATABASE_IMAGE_END)).toBe(false);
    expect(
      written.some(
        (addr) => addr >= DM32_RADIOFOUNDRY_IMAGE_SIZE && addr < DMR_ID_DATABASE_AREA2_ADDRESS,
      ),
    ).toBe(false);
    const countBlock = pipe.block(DMR_ID_DATABASE_ADDRESS);
    const count =
      countBlock[8]! | (countBlock[9]! << 8) | (countBlock[10]! << 16) | (countBlock[11]! << 24);
    expect(count).toBe(DMR_ID_DATABASE_AREA1_RECORDS + 1);
    const spill = pipe.block(DMR_ID_DATABASE_AREA2_ADDRESS);
    const id = DMR_ID_DATABASE_AREA1_RECORDS + 1;
    expect([spill[0], spill[1], spill[2]]).toEqual([
      id & 0xff,
      (id >> 8) & 0xff,
      (id >> 16) & 0xff,
    ]);
  });
});
