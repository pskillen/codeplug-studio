import type { BytePipe } from '../../types.ts';
import {
  Rt95WriteRefusedError,
  assertRt95WriteAllowed,
  type Rt95WriteContext,
} from './modData/writeInterlock.ts';

const encoder = new TextEncoder();
const program = encoder.encode('PROGRAM');
const end = encoder.encode('END');
const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && b.every((value, i) => a[i] === value);

/** Fail closed on every clone-session frame, including unknown factory and relay commands. */
export function guardRt95ClonePipe(
  pipe: BytePipe,
  writeContext: () => Rt95WriteContext | undefined = () => undefined,
): BytePipe {
  return {
    write: async (frame) => {
      if (
        same(frame, program) ||
        same(frame, end) ||
        (frame.length === 1 && frame[0] === 2) ||
        (frame.length === 4 && frame[0] === 0x52 && frame[3] === 16)
      ) {
        await pipe.write(frame);
        return;
      }
      if (frame[0] === 0x57 && frame.length === 22 && frame[3] === 16) {
        const address = frame[1]! * 256 + frame[2]!;
        const ctx = writeContext();
        if (!ctx) throw new Rt95WriteRefusedError(address, 'write outside the guarded write path');
        assertRt95WriteAllowed(address, frame[3], ctx);
        await pipe.write(frame);
        return;
      }
      throw new Rt95WriteRefusedError(0, `unsupported command 0x${(frame[0] ?? 0).toString(16)}`);
    },
    readExact: (n, timeout) => pipe.readExact(n, timeout),
    flush: pipe.flush ? () => pipe.flush!() : undefined,
    close: () => pipe.close(),
  };
}
