/**
 * A scripted AT-D890UV for the range-change tests: one memory, many sessions.
 *
 * It answers PROGRAM, ident, `R` and `W` frames from a sparse flash image, logs every frame per session, and
 * models the one behaviour the wizard relies on: a `W` at LocalInfo is only an overlay until `END`, and `END` after
 * it commits the new range, restarts the radio (the codeplug and settings spans are wiped to `0xFF` and the tune
 * bank's range byte follows the new code). Synthetic data only: serial `TESTSERIAL01`.
 */

import type { BytePipe } from '@integrations/radio-io/types.ts';
import {
  ANYTONE_DMR_ACK,
  anytoneDmrChecksum8AfterOpcode,
} from '@integrations/radio-io/kit/codecs/anytoneDmrRw.ts';
import { RadioTimeoutError } from '@integrations/radio-io/kit/errors.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890_BACKUP_REGION_SPANS } from '@integrations/radio-io/radios/at-d890uv/backupRestoreRoles.ts';
import { makeAtD890IdentFrame } from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import {
  syntheticLocalInfo,
  syntheticTune,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/rangeChangeFixtures.ts';

const UNIT = 0x4_0000;
const TUNE = 0x04f0_0000;

export interface FakeFrame {
  session: number;
  kind: 'PROGRAM' | 'IDENT' | 'R' | 'W' | 'END';
  address?: number;
  length?: number;
}

function sanitise(code: number, localInfo: Uint8Array): number {
  if (code > 18) return 0;
  const unlocked = [0x38, 0x39, 0x30, 0x23].every((b, i) => localInfo[0x0b + i] === b);
  if (code === 14 && !unlocked) return 0;
  return code;
}

export class FakeD890Radio {
  readonly frames: FakeFrame[] = [];
  private units = new Map<number, Uint8Array>();
  private sessions = 0;
  /** What the next `END` should commit, if a LocalInfo `W` arrived in that session. */
  private pendingLocalInfo = new Map<number, Uint8Array>();
  /** Ident byte 8. */
  band: number;
  /** Fail every `W` at this address with a NAK (0x15). */
  nakAddress?: number;
  /** Never answer an `R` at this address (a timeout): an unreadable block. */
  unreadableAddress?: number;
  /** Answer this many `R` frames at `unreadableAddress` first (the connect check reads LocalInfo too). */
  unreadableAfterReads = 0;

  constructor(code = 3) {
    this.band = code;
    this.setBytes(D890_MAP.LocalInfo, syntheticLocalInfo(code));
    this.setBytes(TUNE, syntheticTune(code));
    this.seedCodeplug();
  }

  private unit(base: number): Uint8Array {
    let u = this.units.get(base);
    if (!u) {
      u = new Uint8Array(UNIT).fill(0xff);
      this.units.set(base, u);
    }
    return u;
  }

  setBytes(address: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      const a = address + i;
      this.unit(a - (a % UNIT))[a % UNIT] = data[i]!;
    }
  }

  getBytes(address: number, length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      const a = address + i;
      out[i] = this.unit(a - (a % UNIT))[a % UNIT]!;
    }
    return out;
  }

  /** Non-FF content in every restorable span so a backup, a wipe and a restore are all visible. */
  private seedCodeplug(): void {
    for (const span of AT_D890_BACKUP_REGION_SPANS) {
      if (span.restoreRole !== 'restorable') continue;
      const data = new Uint8Array(span.length);
      for (let i = 0; i < data.length; i++) data[i] = (span.start + i * 7 + 3) & 0xfe;
      this.setBytes(span.start, data);
    }
  }

  /** The reboot after a committed range change: the wipe, and the tune bank follows the range. */
  private reboot(): void {
    for (const span of AT_D890_BACKUP_REGION_SPANS) {
      if (span.restoreRole !== 'restorable') continue;
      this.setBytes(span.start, new Uint8Array(span.length).fill(0xff));
    }
    const tune = this.getBytes(TUNE, 0x2000);
    tune[0x28] = this.band;
    this.setBytes(TUNE, tune);
  }

  /** A new session's pipe. */
  open(): BytePipe & { session: number } {
    const session = ++this.sessions;
    const queue: number[] = [];
    return {
      session,
      write: async (data: Uint8Array) => {
        const text = new TextDecoder().decode(data);
        if (text === 'PROGRAM') {
          this.frames.push({ session, kind: 'PROGRAM' });
          queue.push(0x51, 0x58, ANYTONE_DMR_ACK);
        } else if (data.length === 1 && data[0] === 0x02) {
          this.frames.push({ session, kind: 'IDENT' });
          queue.push(...makeAtD890IdentFrame('V100', { band: this.band }));
        } else if (text === 'END') {
          this.frames.push({ session, kind: 'END' });
          const pending = this.pendingLocalInfo.get(session);
          if (pending) {
            const li = this.getBytes(D890_MAP.LocalInfo, 0x100);
            li.set(pending, 0);
            this.setBytes(D890_MAP.LocalInfo, li);
            this.band = sanitise(pending[3]!, li);
            this.pendingLocalInfo.delete(session);
            this.reboot();
          }
        } else if (data[0] === 0x52) {
          const address = ((data[1]! << 24) | (data[2]! << 16) | (data[3]! << 8) | data[4]!) >>> 0;
          const length = data[5]!;
          this.frames.push({ session, kind: 'R', address, length });
          if (this.unreadableAddress === address) {
            if (this.unreadableAfterReads > 0) this.unreadableAfterReads -= 1;
            else return;
          }
          const body = new Uint8Array(6 + length);
          body[0] = 0x57;
          body.set(data.subarray(1, 6), 1);
          body.set(this.getBytes(address, length), 6);
          queue.push(...body, anytoneDmrChecksum8AfterOpcode(body), ANYTONE_DMR_ACK);
        } else if (data[0] === 0x57) {
          const address = ((data[1]! << 24) | (data[2]! << 16) | (data[3]! << 8) | data[4]!) >>> 0;
          const length = data[5]!;
          this.frames.push({ session, kind: 'W', address, length });
          if (this.nakAddress === address) {
            queue.push(0x15);
            return;
          }
          const payload = data.slice(6, 6 + length);
          if (address === D890_MAP.LocalInfo) {
            // An overlay on the RAM image: committed at END.
            this.pendingLocalInfo.set(session, payload);
          } else {
            this.setBytes(address, payload);
          }
          queue.push(ANYTONE_DMR_ACK);
        }
      },
      readExact: async (n: number) => {
        if (queue.length < n) throw new RadioTimeoutError(`fake radio: need ${n} bytes`);
        return new Uint8Array(queue.splice(0, n));
      },
      flush: async () => {
        queue.length = 0;
      },
      close: async () => {},
    };
  }

  writesIn(session: number): FakeFrame[] {
    return this.frames.filter((f) => f.session === session && f.kind === 'W');
  }
  allWrites(): FakeFrame[] {
    return this.frames.filter((f) => f.kind === 'W');
  }
  endsIn(session: number): number {
    return this.frames.filter((f) => f.session === session && f.kind === 'END').length;
  }
}
