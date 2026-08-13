import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
  type RadioBackupRegionV1,
} from '../../backup/types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  PROGRAM_QX_ACK,
  PROGRAM_QX_BLOCK_SIZE,
  PROGRAM_QX_READ_OPCODE,
  PROGRAM_QX_WRITE_OPCODE,
  programQxChecksum8AfterOpcode,
} from '../../kit/codecs/programQx.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { RT95_DESCRIPTOR } from './descriptor.ts';
import { createRt95Protocol, Rt95Protocol } from './protocol.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import {
  RT95_BLOCK_ADDR_END,
  RT95_BLOCK_ADDR_START,
  RT95_BLOCK_COUNT,
  RT95_BLOCK_SIZE,
  RT95_IMAGE_SIZE,
  RT95_MODEL_ID,
  RT95_UPLOAD_PRIME_ADDR,
} from './constants.ts';
import {
  intendedRt95RestoreImage,
  RT95_PROGRAMMING_IMAGE_REGION_ID,
} from './restoreFromBackup.ts';

const here = dirname(fileURLToPath(import.meta.url));

function identBytes(): Uint8Array {
  const model = 'RT95-P'.padEnd(7, '\0');
  const version = 'V100'.padEnd(6, '\0');
  const bytes: number[] = [0x49];
  for (const c of model) bytes.push(c.charCodeAt(0));
  bytes.push(0x01);
  for (const c of version) bytes.push(c.charCodeAt(0));
  bytes.push(0x06);
  return new Uint8Array(bytes);
}

function buildReadReply(addr: number, payload: Uint8Array): Uint8Array {
  const header = new Uint8Array(4);
  header[0] = PROGRAM_QX_READ_OPCODE;
  header[1] = (addr >>> 8) & 0xff;
  header[2] = addr & 0xff;
  header[3] = payload.length & 0xff;
  const body = new Uint8Array(4 + payload.length);
  body.set(header, 0);
  body.set(payload, 4);
  const checksum = programQxChecksum8AfterOpcode(body);
  const frame = new Uint8Array(body.length + 2);
  frame.set(body, 0);
  frame[body.length] = checksum;
  frame[body.length + 1] = PROGRAM_QX_ACK;
  return frame;
}

class ScriptedQxPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private readBuf = new Uint8Array(0);

  private enqueue(chunk: Uint8Array): void {
    const next = new Uint8Array(this.readBuf.length + chunk.length);
    next.set(this.readBuf);
    next.set(chunk, this.readBuf.length);
    this.readBuf = next;
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    this.enqueue(data);
    const text = new TextDecoder().decode(data);
    if (text === 'PROGRAM') {
      this.enqueue(new Uint8Array([0x51, 0x58, PROGRAM_QX_ACK]));
      return;
    }
    if (text === 'END') return;
    if (data.length === 1 && data[0] === 0x02) {
      this.enqueue(identBytes());
      return;
    }
    if (data[0] === PROGRAM_QX_READ_OPCODE) {
      const addr = (data[1]! << 8) | data[2]!;
      this.enqueue(buildReadReply(addr, new Uint8Array(PROGRAM_QX_BLOCK_SIZE)));
      return;
    }
    if (data[0] === PROGRAM_QX_WRITE_OPCODE) {
      this.enqueue(new Uint8Array([PROGRAM_QX_ACK]));
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.readBuf.length < n) {
      throw new Error(`ScriptedQxPipe: needed ${n} bytes, have ${this.readBuf.length}`);
    }
    const result = this.readBuf.slice(0, n);
    this.readBuf = this.readBuf.length > n ? this.readBuf.slice(n) : new Uint8Array(0);
    return result;
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

function region(
  id: string,
  address: number,
  byteLength: number,
  restoreRole: RadioBackupRegionV1['restoreRole'],
): RadioBackupRegionV1 {
  return {
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole,
  };
}

function cloneManifest(regions: RadioBackupRegionV1[]): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: RT95_MODEL_ID,
    descriptorLabel: 'Retevis RT95 VOX',
    firmware: 'V100',
    coverage: 'full-clone',
    imageByteLength: RT95_IMAGE_SIZE,
    regions,
  };
}

describe('intendedRt95RestoreImage', () => {
  it('copies the selected restorable programming clone', () => {
    const bytes = buildSyntheticRt95Image();
    const image = memoryMapFromBytes(bytes);
    const archive = {
      manifest: cloneManifest([
        region(RT95_PROGRAMMING_IMAGE_REGION_ID, 0, RT95_IMAGE_SIZE, 'restorable'),
      ]),
      image,
    };
    const intended = intendedRt95RestoreImage(archive, [RT95_PROGRAMMING_IMAGE_REGION_ID]);
    expect(intended.size).toBe(RT95_IMAGE_SIZE);
    expect(intended.get(0, RT95_BLOCK_SIZE)).toEqual(image.get(0, RT95_BLOCK_SIZE));
    expect(intended.bytes[0]).toBe(bytes[0]);
  });

  it('omits inspect-only and unselected bins', () => {
    const bytes = buildSyntheticRt95Image();
    const image = memoryMapFromBytes(bytes);
    expect(() =>
      intendedRt95RestoreImage(
        {
          manifest: cloneManifest([
            region(RT95_PROGRAMMING_IMAGE_REGION_ID, 0, RT95_IMAGE_SIZE, 'inspect-only'),
          ]),
          image,
        },
        [RT95_PROGRAMMING_IMAGE_REGION_ID],
      ),
    ).toThrow(RadioProtocolError);
    expect(() =>
      intendedRt95RestoreImage(
        {
          manifest: cloneManifest([
            region(RT95_PROGRAMMING_IMAGE_REGION_ID, 0, RT95_IMAGE_SIZE, 'restorable'),
          ]),
          image,
        },
        [],
      ),
    ).toThrow(/no restorable clone bins/);
  });

  it('does not import assemble / hydration merge / write-image helpers', () => {
    const src = readFileSync(join(here, 'restoreFromBackup.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/hydration\.ts'/);
    expect(src).not.toMatch(/mergeChannelsInto/);
    expect(src).not.toMatch(/prepareRadioWriteImage/);
    expect(src).not.toMatch(/\bassemble\(/);
  });
});

describe('Rt95Protocol.restoreFromBackup', () => {
  it('uploads the programming clone without a live clone download', async () => {
    const pipe = new ScriptedQxPipe();
    const proto = new Rt95Protocol();
    await proto.connect(pipe, { handshake: 'none' });
    const writesAfterConnect = pipe.writes.length;

    const bytes = buildSyntheticRt95Image();
    const image = memoryMapFromBytes(bytes);
    const stages: string[] = [];
    await proto.restoreFromBackup(
      {
        manifest: cloneManifest([
          region(RT95_PROGRAMMING_IMAGE_REGION_ID, 0, RT95_IMAGE_SIZE, 'restorable'),
        ]),
        image,
      },
      {
        regionIds: [RT95_PROGRAMMING_IMAGE_REGION_ID],
        onProgress: (p) => {
          if (p.stage) stages.push(p.stage);
        },
      },
    );

    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    const reads = restoreWrites.filter((w) => w[0] === PROGRAM_QX_READ_OPCODE);
    expect(reads).toHaveLength(1);
    expect((reads[0]![1]! << 8) | reads[0]![2]!).toBe(RT95_UPLOAD_PRIME_ADDR);
    const writes = restoreWrites.filter((w) => w[0] === PROGRAM_QX_WRITE_OPCODE);
    expect(writes).toHaveLength(RT95_BLOCK_COUNT);
    expect(stages).toContain('Restore');
    expect(stages).not.toContain('Pre-write read');

    const firstPayload = writes[0]!.subarray(4, 4 + RT95_BLOCK_SIZE);
    expect(firstPayload).toEqual(image.get(0, RT95_BLOCK_SIZE));
    const lastAddr = RT95_BLOCK_ADDR_END;
    const last = writes[writes.length - 1]!;
    expect((last[1]! << 8) | last[2]!).toBe(lastAddr);
    expect(last.subarray(4, 4 + RT95_BLOCK_SIZE)).toEqual(image.get(lastAddr, RT95_BLOCK_SIZE));
    expect(RT95_BLOCK_ADDR_START).toBe(0);
  });

  it('protocolFactory exposes restoreFromBackup; Write still requires stash', () => {
    const radio = createRt95Protocol();
    expect(typeof radio.restoreFromBackup).toBe('function');
    expect(RT95_DESCRIPTOR.hydrationRequiredForWrite).toBe(true);
  });
});
