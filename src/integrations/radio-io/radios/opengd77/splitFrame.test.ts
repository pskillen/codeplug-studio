/**
 * A frame split across two USB packets against the firmware-faithful fake (busy and lost-reply rules),
 * and the whole 69,600-entry User Database Write through the real Web Serial pipe: no frame may
 * straddle the host buffer boundary, so none can be split in the first place.
 */

import { describe, expect, it } from 'vitest';
import {
  OPENGD77_TYPE_READ,
  OPENGD77_TYPE_WRITE_UV380,
  OPENGD77_WRITE_CMD_FINISH_SECTOR,
  OPENGD77_WRITE_CMD_SECTOR_BUFFER,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../kit/codecs/opengd77Serial.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import type { RadioDigitalContactDto } from '../../radioChannelDto.ts';
import { createFakeSerialPort } from '../../transport/fakeSerialPort.ts';
import {
  openWebSerialPipe,
  WEB_SERIAL_HOST_BUFFER_SIZE,
  type WebSerialPipe,
} from '../../transport/webSerialPipe.ts';
import { OpenGd77Protocol } from './protocol.ts';
import { encodeOpenGd77UserDatabase } from './userDatabaseCodec.ts';
import { buildUserDatabaseSectorPayloads } from './userDatabaseWrite.ts';
import { OpenGd77ScriptedPipe, type SplitSpec } from './__fixtures__/scriptedPipe.ts';

const SET = OPENGD77_WRITE_CMD_SET_SECTOR;
const BUF = OPENGD77_WRITE_CMD_SECTOR_BUFFER;
const FIN = OPENGD77_WRITE_CMD_FINISH_SECTOR;

function contacts(n: number): RadioDigitalContactDto[] {
  return Array.from({ length: n }, (_, i) => ({
    wireName: `Op ${i}`,
    digitalId: 1000 + i,
    callsign: `M0A${i}`,
    city: '',
    province: '',
    country: '',
    remark: '',
  }));
}

function intendedSectors(n: number): Map<number, Uint8Array> {
  return buildUserDatabaseSectorPayloads(encodeOpenGd77UserDatabase(contacts(n)));
}

function flashMatches(pipe: OpenGd77ScriptedPipe, sectors: Map<number, Uint8Array>): boolean {
  for (const [abs, payload] of sectors) {
    for (let i = 0; i < payload.length; i++) {
      if (pipe.flashByte(abs + i) !== payload[i]) return false;
    }
  }
  return true;
}

/** Cumulative TX offset of the `nth` (0-based) `X` frame with command `cmd`, from a clean run. */
async function offsetOf(cmd: number, nth: number, n: number): Promise<number> {
  const pipe = new OpenGd77ScriptedPipe(0x08);
  const proto = new OpenGd77Protocol();
  await proto.connect(pipe, { settleScale: 0 });
  await proto.uploadUserDatabase(contacts(n), {});
  let off = 0;
  let seen = 0;
  for (const w of pipe.writes) {
    if (w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === cmd) {
      if (seen === nth) return off;
      seen++;
    }
    off += w.length;
  }
  throw new Error(`no ${nth}th frame for command ${cmd}`);
}

interface Outcome {
  readonly threw: Error | undefined;
  readonly fired: boolean;
  readonly flashCorrect: boolean;
  readonly setFrames: number;
}

async function writeWithSplit(spec: SplitSpec, n: number): Promise<Outcome> {
  const pipe = new OpenGd77ScriptedPipe(0x08);
  const proto = new OpenGd77Protocol();
  await proto.connect(pipe, { settleScale: 0 });
  pipe.splitAt(spec);
  let threw: Error | undefined;
  try {
    await proto.uploadUserDatabase(contacts(n), {});
  } catch (err) {
    threw = err as Error;
  }
  return {
    threw,
    fired: pipe.splitFired !== undefined,
    flashCorrect: flashMatches(pipe, intendedSectors(n)),
    setFrames: pipe.writesOf(SET).length,
  };
}

describe('split frame against the firmware-faithful fake', () => {
  const N = 300;
  const classes: { name: string; cmd: number; nth: number; k: number }[] = [
    { name: 'SET_SECTOR cut after its command byte', cmd: SET, nth: 1, k: 2 },
    { name: 'SECTOR_BUFFER cut after the type byte', cmd: BUF, nth: 5, k: 1 },
    { name: 'SECTOR_BUFFER cut inside its header', cmd: BUF, nth: 5, k: 4 },
    { name: 'SECTOR_BUFFER cut inside its data', cmd: BUF, nth: 5, k: 20 },
    { name: 'FINISH cut after the type byte', cmd: FIN, nth: 0, k: 1 },
  ];
  const variants: { name: string; busy: boolean; dropBReply?: boolean }[] = [
    { name: 'busy (ISR dash, reply lost)', busy: true },
    { name: 'not busy', busy: false },
    { name: 'not busy, B reply dropped (silent)', busy: false, dropBReply: true },
  ];

  for (const c of classes) {
    for (const v of variants) {
      it(`${c.name}, ${v.name}: never ends with wrong bytes reported as success`, async () => {
        const at = (await offsetOf(c.cmd, c.nth, N)) + c.k;
        const out = await writeWithSplit({ txByte: at, busy: v.busy, dropBReply: v.dropBReply }, N);
        expect(out.fired).toBe(true);
        if (out.threw) {
          expect(out.threw).toBeInstanceOf(RadioProtocolError);
        } else {
          // Recovery restarted the sector: the radio holds exactly what was sent.
          expect(out.flashCorrect).toBe(true);
          // And it took more than one SET_SECTOR to get there (the split was noticed, not luck).
          expect(out.setFrames).toBeGreaterThan(Math.ceil((12 + N * 27) / 4096));
        }
      });
    }
  }

  it('a split R answers length 0, which a read rejects', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe, { settleScale: 0 });
    pipe.splitAt({ txByte: pipe.txBytes + 4, busy: false });
    await expect(proto.downloadUserDatabaseOccupied({})).rejects.toBeInstanceOf(Error);
    expect(pipe.splitFired?.frame[0]).toBe(OPENGD77_TYPE_READ);
  });
});

describe('User Database Write through the real Web Serial pipe', () => {
  it('writes 69,600 entries and no frame straddles a host buffer boundary', async () => {
    const N = 69_600;
    const radio = new OpenGd77ScriptedPipe(0x08);
    const holder: { push?: (b: Uint8Array) => void } = {};
    const fake = createFakeSerialPort({
      onWrite: async (chunk) => {
        await radio.write(chunk);
        const out = await radio.drain();
        if (out.length > 0) holder.push?.(out);
      },
    });
    holder.push = (b) => fake.pushRead(b);

    const pipe = (await openWebSerialPipe(fake.port, 115200)) as WebSerialPipe;
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe, { settleScale: 0 });
    await proto.uploadUserDatabase(contacts(N), {});
    await pipe.close();

    const B = WEB_SERIAL_HOST_BUFFER_SIZE;
    expect(pipe.txBytesWritten).toBeGreaterThan(2 * B);
    for (const stream of fake.writeStreams) {
      let off = 0;
      for (const chunk of stream) {
        const first = Math.floor(off / B);
        const last = Math.floor((off + chunk.length - 1) / B);
        expect(last).toBe(first);
        off += chunk.length;
      }
    }
    // The radio saw every frame whole: 459 sectors, no refusals, every sector programmed.
    expect(radio.writesOf(FIN)).toHaveLength(459);
    expect(radio.writesOf(SET)).toHaveLength(459);
    expect(radio.flashByte(0x50000)).toBe(0x49);
  }, 300_000);
});
