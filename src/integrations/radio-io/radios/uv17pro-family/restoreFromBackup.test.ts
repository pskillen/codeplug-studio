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
import { PROGRAM_RW_ACK } from '../../kit/codecs/programRw.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { uv17ProCrypt } from './crypt.ts';
import { UV21_PRO_V2_LAYOUT, UV5R_MINI_LAYOUT } from './layout.ts';
import { Uv17ProProtocol } from './protocol.ts';
import { uv17ProBackupMemSpans } from './backupRestoreRoles.ts';
import {
  intendedUv17ProRestoreImage,
  listUv17ProRestoreWriteAddresses,
} from './restoreFromBackup.ts';

const here = dirname(fileURLToPath(import.meta.url));

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

class ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private readBuf = new Uint8Array(0);

  constructor(private readonly layout: typeof UV5R_MINI_LAYOUT) {}

  private enqueue(...chunks: Uint8Array[]): void {
    for (const chunk of chunks) {
      const next = new Uint8Array(this.readBuf.length + chunk.length);
      next.set(this.readBuf);
      next.set(chunk, this.readBuf.length);
      this.readBuf = next;
    }
  }

  private respondToMagic(data: Uint8Array): boolean {
    for (const magic of [...this.layout.magics.read, ...this.layout.magics.upload]) {
      if (bytesEqual(data, magic.send)) {
        this.enqueue(new Uint8Array(magic.responseLen));
        return true;
      }
    }
    return false;
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (bytesEqual(data, this.layout.ident)) {
      this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
      return;
    }
    if (this.respondToMagic(data)) return;
    if (data[0] === 0x57) {
      this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.readBuf.length < n) {
      throw new Error(`ScriptedPipe: needed ${n} bytes, have ${this.readBuf.length}`);
    }
    const result = this.readBuf.slice(0, n);
    this.readBuf = this.readBuf.length > n ? this.readBuf.slice(n) : new Uint8Array(0);
    return result;
  }

  async flush(): Promise<void> {
    this.readBuf = new Uint8Array(0);
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

function manifestFor(
  layout: typeof UV5R_MINI_LAYOUT,
  regions: RadioBackupRegionV1[],
): RadioBackupManifestV1 {
  return {
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
}

function patternedImage(layout: typeof UV5R_MINI_LAYOUT): ReturnType<typeof createMemoryMap> {
  const image = createMemoryMap(layout.memTotal);
  for (const span of uv17ProBackupMemSpans(layout)) {
    image.fill(span.packedOffset, span.size, (span.packedOffset + 0x11) & 0xff);
  }
  return image;
}

function restorableRegions(layout: typeof UV5R_MINI_LAYOUT): RadioBackupRegionV1[] {
  return uv17ProBackupMemSpans(layout).map((span) =>
    region(span.id, span.packedOffset, span.size, span.restoreRole),
  );
}

function decryptWritePayload(
  layout: typeof UV5R_MINI_LAYOUT,
  frame: Uint8Array,
): { addr: number; plain: Uint8Array } {
  const addr = (frame[1]! << 8) | frame[2]!;
  const encrypted = frame.subarray(4);
  return { addr, plain: uv17ProCrypt(encrypted, layout.defaultEncrsym) };
}

describe('intendedUv17ProRestoreImage', () => {
  it('copies selected restorable MEM bins onto a packed clone', () => {
    const layout = UV5R_MINI_LAYOUT;
    const image = patternedImage(layout);
    const archive = { manifest: manifestFor(layout, restorableRegions(layout)), image };
    const ids = uv17ProBackupMemSpans(layout).map((s) => s.id);
    const intended = intendedUv17ProRestoreImage(layout, archive, ids);
    expect(intended.size).toBe(layout.memTotal);
    expect(intended.get(0, 16)).toEqual(image.get(0, 16));
    const mem1 = uv17ProBackupMemSpans(layout)[1]!;
    expect(intended.get(mem1.packedOffset, mem1.size)).toEqual(
      image.get(mem1.packedOffset, mem1.size),
    );
  });

  it('omits inspect-only and unselected spans', () => {
    const layout = UV5R_MINI_LAYOUT;
    const image = patternedImage(layout);
    const spans = uv17ProBackupMemSpans(layout);
    const archive = {
      manifest: manifestFor(layout, [
        region(spans[0]!.id, spans[0]!.packedOffset, spans[0]!.size, 'inspect-only'),
        ...spans
          .slice(1)
          .map((span) => region(span.id, span.packedOffset, span.size, 'restorable')),
      ]),
      image,
    };
    const intended = intendedUv17ProRestoreImage(
      layout,
      archive,
      spans.map((s) => s.id),
    );
    expect(intended.get(0, 1)[0]).toBe(0xff);
    expect(intended.get(spans[1]!.packedOffset, 1)[0]).not.toBe(0xff);
    expect(
      listUv17ProRestoreWriteAddresses(
        layout,
        archive,
        spans.map((s) => s.id),
      ),
    ).not.toContain(0x0000);
  });

  it('does not import assemble / hydration merge / write-image helpers', () => {
    const src = readFileSync(join(here, 'restoreFromBackup.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/hydration\.ts'/);
    expect(src).not.toMatch(/mergeChannelsInto/);
    expect(src).not.toMatch(/prepareRadioWriteImage/);
    expect(src).not.toMatch(/\bassemble\(/);
  });
});

describe('Uv17ProProtocol.restoreFromBackup', () => {
  it('uploads packed restorable MEM bytes without a live clone download', async () => {
    const layout = UV5R_MINI_LAYOUT;
    const pipe = new ScriptedPipe(layout);
    const proto = new Uv17ProProtocol(layout);
    await proto.connect(pipe, { handshake: 'none' });
    const writesAfterConnect = pipe.writes.length;

    const image = patternedImage(layout);
    const ids = uv17ProBackupMemSpans(layout).map((s) => s.id);
    const stages: string[] = [];
    await proto.restoreFromBackup(
      { manifest: manifestFor(layout, restorableRegions(layout)), image },
      {
        regionIds: ids,
        onProgress: (p) => {
          if (p.stage) stages.push(p.stage);
        },
      },
    );

    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    const reads = restoreWrites.filter((w) => w[0] === 0x52);
    expect(reads).toHaveLength(0);
    const writes = restoreWrites.filter((w) => w[0] === 0x57);
    expect(writes).toHaveLength(layout.cloneBlockCount);
    expect(stages).toContain('Restore');
    expect(stages).not.toContain('Pre-write read');

    const first = decryptWritePayload(layout, writes[0]!);
    expect(first.addr).toBe(0x0000);
    expect(first.plain).toEqual(image.get(0, layout.blockSize));
    const mem2 = uv17ProBackupMemSpans(layout)[2]!;
    const last = decryptWritePayload(layout, writes[writes.length - 1]!);
    expect(last.addr).toBe(mem2.radioAddr + mem2.size - layout.blockSize);
    expect(last.plain).toEqual(
      image.get(mem2.packedOffset + mem2.size - layout.blockSize, layout.blockSize),
    );
  });

  it('does not write unselected MEM spans', async () => {
    const layout = UV5R_MINI_LAYOUT;
    const pipe = new ScriptedPipe(layout);
    const proto = new Uv17ProProtocol(layout);
    await proto.connect(pipe, { handshake: 'none' });
    const image = patternedImage(layout);
    const mem2 = uv17ProBackupMemSpans(layout)[2]!;
    await proto.restoreFromBackup(
      { manifest: manifestFor(layout, restorableRegions(layout)), image },
      { regionIds: [mem2.id] },
    );
    const writes = pipe.writes.filter((w) => w[0] === 0x57);
    expect(writes).toHaveLength(mem2.size / layout.blockSize);
    const addrs = writes.map((w) => (w[1]! << 8) | w[2]!);
    expect(addrs.every((a) => a >= mem2.radioAddr && a < mem2.radioAddr + mem2.size)).toBe(true);
    expect(addrs).not.toContain(0x0000);
    expect(addrs).not.toContain(0x9000);
  });

  it('uploads the UV-21 four-region clone', async () => {
    const layout = UV21_PRO_V2_LAYOUT;
    const pipe = new ScriptedPipe(layout);
    const proto = new Uv17ProProtocol(layout);
    await proto.connect(pipe, { handshake: 'none' });
    const image = patternedImage(layout);
    await proto.restoreFromBackup(
      { manifest: manifestFor(layout, restorableRegions(layout)), image },
      { regionIds: uv17ProBackupMemSpans(layout).map((s) => s.id) },
    );
    const writes = pipe.writes.filter((w) => w[0] === 0x57);
    expect(writes).toHaveLength(layout.cloneBlockCount);
    const last = decryptWritePayload(layout, writes[writes.length - 1]!);
    expect(last.addr).toBe(0xd000 + 0x40 - layout.blockSize);
  });
});
