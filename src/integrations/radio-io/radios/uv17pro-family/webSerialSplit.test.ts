/**
 * UV-family Write sessions through the real `openWebSerialPipe` (with the fake serial port): no frame is ever cut
 * by the writable-stream ring boundary, and a normal Write session never reaches it (#1547).
 */
import { describe, expect, it } from 'vitest';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { createFakeSerialPort } from '../../transport/fakeSerialPort.ts';
import {
  openWebSerialPipe,
  WEB_SERIAL_HOST_BUFFER_SIZE,
  type WebSerialPipe,
} from '../../transport/webSerialPipe.ts';
import { uv17ProCrypt } from './crypt.ts';
import { UV21_PRO_V2_LAYOUT, UV5R_MINI_LAYOUT, type Uv17ProLayout } from './layout.ts';
import { packedOffsetForRadioAddr, Uv17ProProtocol } from './protocol.ts';

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** A scripted UV-family radio behind a fake serial port. Memory starts blank; `W` frames update it. */
function createRadioBehindFakePort(layout: Uv17ProLayout) {
  const memory = new Map<number, Uint8Array>();
  const ACK = new Uint8Array([0x06]);
  const fake = createFakeSerialPort({
    onWrite(data) {
      // Anything larger than a protocol frame (the boundary filler) is not addressed to the radio.
      if (data.length > 4 + layout.blockSize) return;
      if (bytesEqual(data, layout.ident)) {
        fake.pushRead(ACK);
        return;
      }
      for (const magic of [...layout.magics.read, ...layout.magics.upload]) {
        if (bytesEqual(data, magic.send)) {
          fake.pushRead(new Uint8Array(magic.responseLen));
          return;
        }
      }
      const addr = (data[1]! << 8) | data[2]!;
      if (data[0] === 0x52) {
        const plain = memory.get(addr) ?? new Uint8Array(layout.blockSize);
        const reply = new Uint8Array(4 + layout.blockSize);
        reply.set([0x52, data[1]!, data[2]!, layout.blockSize]);
        reply.set(uv17ProCrypt(plain, layout.defaultEncrsym), 4);
        fake.pushRead(reply);
        return;
      }
      if (data[0] === 0x57) {
        memory.set(addr, uv17ProCrypt(data.slice(4), layout.defaultEncrsym));
        fake.pushRead(ACK);
        return;
      }
      throw new Error(`unexpected frame (${data.length} B, first byte 0x${data[0]!.toString(16)})`);
    },
  });
  return { fake, memory };
}

/** The Write session shape of `useRadioWriteFlow`: read handshake, pre-write read, modify, upload. No 2nd handshake. */
async function runWriteSession(layout: Uv17ProLayout, pipe: WebSerialPipe) {
  const radio = new Uv17ProProtocol(layout);
  await radio.connect(pipe, { settleScale: 0 });
  const image = await radio.download({});
  image.bytes[0x10] = 0xa5;
  image.bytes[layout.memTotal - 1] = 0x5a;
  await radio.upload(memoryMapFromBytes(image.bytes), {});
  return image;
}

const CASES = [
  { name: 'UV-5R Mini', layout: UV5R_MINI_LAYOUT, writeTxBytes: 37_555 },
  { name: 'UV-21 Pro V2', layout: UV21_PRO_V2_LAYOUT, writeTxBytes: 37_915 },
] as const;

describe.each(CASES)('$name Write through openWebSerialPipe', ({ layout, writeTxBytes }) => {
  const frameBytes = 4 + layout.blockSize;

  it('A: a full Write session stays on one stream with no rotation', async () => {
    const { fake } = createRadioBehindFakePort(layout);
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    await runWriteSession(layout, pipe);

    expect(pipe.txBytesWritten).toBe(writeTxBytes);
    expect(pipe.writerRotations).toBe(0);
    expect(fake.writeStreams).toHaveLength(1);
    expect(pipe.txBytesWritten).toBeLessThan(WEB_SERIAL_HOST_BUFFER_SIZE);
    await pipe.close();
  });

  it('B: rotates exactly once at the boundary and every W chunk stays whole', async () => {
    const { fake, memory } = createRadioBehindFakePort(layout);
    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    await pipe.write(new Uint8Array(WEB_SERIAL_HOST_BUFFER_SIZE - 1000));
    const image = await runWriteSession(layout, pipe);

    expect(pipe.writerRotations).toBe(1);
    expect(fake.writeStreams).toHaveLength(2);
    const writes = fake.written.slice(1).filter((c) => c[0] === 0x57); // skip the filler
    expect(writes.length).toBeGreaterThan(0);
    for (const chunk of writes) {
      expect(chunk).toHaveLength(frameBytes);
      expect(chunk[0]).toBe(0x57);
    }
    for (const stream of fake.writeStreams) {
      expect(stream.reduce((n, c) => n + c.length, 0)).toBeLessThanOrEqual(
        WEB_SERIAL_HOST_BUFFER_SIZE,
      );
    }
    // The radio ended up holding exactly the intended image.
    expect(memory.size).toBe(layout.cloneBlockCount);
    for (const [addr, plain] of memory) {
      const packed = packedOffsetForRadioAddr(layout, addr);
      expect(plain).toEqual(image.bytes.slice(packed, packed + layout.blockSize));
    }
    await pipe.close();
  });
});
