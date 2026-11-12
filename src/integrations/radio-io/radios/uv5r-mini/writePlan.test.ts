import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
  type RadioBackupRegionV1,
} from '../../backup/types.ts';
import { fakeMagicReply } from '../uv17pro-family/magicReplyTestKit.ts';
import { PROGRAM_RW_ACK } from '../../kit/codecs/programRw.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { UV5R_MINI_LAYOUT as layout } from '../uv17pro-family/layout.ts';
import { Uv17ProProtocol } from '../uv17pro-family/protocol.ts';
import { uv17ProBackupMemSpans } from '../uv17pro-family/backupRestoreRoles.ts';
import { Uv5rMiniWriteRefusedError } from './writeInterlock.ts';

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Fake pipe: acks ident, magics and `W` frames; records every frame. */
class FakePipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private buf = new Uint8Array(0);

  private enqueue(chunk: Uint8Array): void {
    const next = new Uint8Array(this.buf.length + chunk.length);
    next.set(this.buf);
    next.set(chunk, this.buf.length);
    this.buf = next;
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (bytesEqual(data, layout.ident)) return this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
    for (const m of [...layout.magics.read, ...layout.magics.upload]) {
      if (bytesEqual(data, m.send))
        return this.enqueue(fakeMagicReply(m.send, m.responseLen, layout.modelReplyPrefix));
    }
    if (data[0] === 0x57) this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.buf.length < n) throw new Error(`FakePipe: needed ${n}, have ${this.buf.length}`);
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }

  async flush(): Promise<void> {
    this.buf = new Uint8Array(0);
  }

  async close(): Promise<void> {
    /* no-op */
  }

  wAddresses(): number[] {
    return this.writes.filter((w) => w[0] === 0x57).map((w) => (w[1]! << 8) | w[2]!);
  }
}

function range(start: number, size: number): number[] {
  const out: number[] = [];
  for (let a = start; a < start + size; a += 0x40) out.push(a);
  return out;
}

const MEM0 = range(0x0000, 0x8040);
const MEM1 = range(0x9000, 0x40);
const MEM2 = range(0xa000, 0x1c0);

function region(id: string, address: number, byteLength: number): RadioBackupRegionV1 {
  return {
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole: 'restorable',
  };
}

function archive(extra: RadioBackupRegionV1[] = []) {
  const regions = [
    ...uv17ProBackupMemSpans(layout).map((s) => region(s.id, s.packedOffset, s.size)),
    ...extra,
  ];
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: layout.radioModelId,
    descriptorLabel: layout.protocolLabel,
    coverage: 'full-clone',
    imageByteLength: layout.memTotal,
    regions,
  };
  return { manifest, image: createMemoryMap(layout.memTotal) };
}

async function connected() {
  const pipe = new FakePipe();
  const proto = new Uv17ProProtocol(layout);
  await proto.connect(pipe, { handshake: 'none' });
  pipe.writes.length = 0;
  return { pipe, proto };
}

describe('UV-5R Mini write plan', () => {
  it('Write sends exactly 521 blocks, in order, to the three allowed spans', async () => {
    const { pipe, proto } = await connected();
    await proto.upload(createMemoryMap(layout.memTotal), {});
    const addrs = pipe.wAddresses();
    expect(addrs).toHaveLength(521);
    expect(addrs).toEqual([...MEM0, ...MEM1, ...MEM2]);
    expect(addrs[0]).toBe(0x0000);
    expect(addrs[512]).toBe(0x8000);
    expect(addrs[513]).toBe(0x9000);
    expect(addrs[514]).toBe(0xa000);
    expect(addrs[520]).toBe(0xa180);
  });

  it.each([
    ['mem-0', MEM0],
    ['mem-1', MEM1],
    ['mem-2', MEM2],
    ['all', [...MEM0, ...MEM1, ...MEM2]],
  ] as const)('Restore of %s sends exactly its blocks', async (id, expected) => {
    const { pipe, proto } = await connected();
    const ids = id === 'all' ? ['mem-0', 'mem-1', 'mem-2'] : [id];
    await proto.restoreFromBackup(archive(), { regionIds: ids });
    expect(pipe.wAddresses()).toEqual(expected);
  });

  it('Restore from a manifest naming an extra region is refused before the first frame', async () => {
    const { pipe, proto } = await connected();
    const extra = [region('mem-3', 0xd000, 0x40)];
    await expect(
      proto.restoreFromBackup(archive(extra), {
        regionIds: ['mem-0', 'mem-1', 'mem-2', 'mem-3'],
      }),
    ).rejects.toThrow(/outside the write set/);
    expect(pipe.writes).toHaveLength(0);
  });

  it('a layout whose plan reaches a refused address sends no frame at all', async () => {
    const pipe = new FakePipe();
    const bad = {
      ...layout,
      memStarts: [0x0000, 0x9000, 0xd000],
      memSizes: [0x8040, 0x40, 0x40],
      memTotal: 0x8080,
      cloneBlockCount: 514,
    };
    const proto = new Uv17ProProtocol(bad);
    await proto.connect(pipe, { handshake: 'none' });
    pipe.writes.length = 0;
    await expect(proto.upload(createMemoryMap(bad.memTotal), {})).rejects.toThrow(
      Uv5rMiniWriteRefusedError,
    );
    expect(pipe.writes).toHaveLength(0);
  });
});
