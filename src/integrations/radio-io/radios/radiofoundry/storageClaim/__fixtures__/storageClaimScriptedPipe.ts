import { RadioTimeoutError } from '../../../../kit/errors.ts';
import {
  decodeDebugFrame,
  encodeDebugFrame,
} from '../../../../kit/codecs/radioFoundryDebugLink.ts';
import type { BytePipe } from '../../../../types.ts';
import { CODEPLUG_COMMAND } from '../../constants.ts';
import { RADIOFOUNDRY_STORAGE_COMMAND } from '../../storageInfo.ts';
import { RADIOFOUNDRY_VERSION_COMMAND } from '../../version.ts';
import { RADIOFOUNDRY_INFO_CHIP_COMMAND } from '../chipInfo.ts';
import { STORAGE_OP_CLAIM } from '../storageClaimFrame.ts';
import { STORAGE_OP_INFO, STORAGE_OP_READ } from '../storageClaimSend.ts';

const DM32_VERSION =
  'proto=1\ngit=454a5b76\ngit_time=1795365604\nsource=official\nboard=DM-32UV\nfeatures=\n';

export class StorageClaimScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private pending = new Uint8Array(0);
  versionText = DM32_VERSION;
  storageRegion = 2;
  storageClaimPending = 0;
  settingsAddr = 0x0711000;
  settingsSize = 0x8000;
  journalAddr = 0x0719000;
  journalSize = 0x2000;
  calAddr = 0;
  calSize = 0;
  chipToken = 0x12345678;
  chipStatus = 0;
  storageReadData = new Map<string, Uint8Array>();
  claimCount = 0;
  afterClaimRegion: number | null = null;
  silent = false;

  async write(data: Uint8Array): Promise<void> {
    const copy = data.slice();
    this.writes.push(copy);
    if (this.silent) return;
    const req = decodeDebugFrame(copy);
    if (req.command === RADIOFOUNDRY_VERSION_COMMAND) {
      const text = new TextEncoder().encode(this.versionText);
      const payload = Uint8Array.from([0, ...text]);
      this.enqueue(encodeDebugFrame(RADIOFOUNDRY_VERSION_COMMAND | 0x80, req.seq, payload));
      return;
    }
    if (req.command === RADIOFOUNDRY_INFO_CHIP_COMMAND) {
      const body = new Uint8Array(29);
      body[6] = this.chipToken & 0xff;
      body[7] = (this.chipToken >>> 8) & 0xff;
      body[8] = (this.chipToken >>> 16) & 0xff;
      body[9] = (this.chipToken >>> 24) & 0xff;
      body[28] = 1;
      const payload = Uint8Array.from([this.chipStatus, ...body]);
      this.enqueue(encodeDebugFrame(RADIOFOUNDRY_INFO_CHIP_COMMAND | 0x80, req.seq, payload));
      return;
    }
    if (req.command === RADIOFOUNDRY_STORAGE_COMMAND) {
      const op = req.payload[0]!;
      if (op === STORAGE_OP_INFO) {
        const region =
          this.claimCount > 0 && this.afterClaimRegion != null
            ? this.afterClaimRegion
            : this.storageRegion;
        const data26 = new Uint8Array(26);
        data26[0] = region;
        data26[1] = this.storageClaimPending;
        this.writeU32(data26, 2, this.settingsAddr);
        this.writeU32(data26, 6, this.settingsSize);
        this.writeU32(data26, 10, this.journalAddr);
        this.writeU32(data26, 14, this.journalSize);
        this.writeU32(data26, 18, this.calAddr);
        this.writeU32(data26, 22, this.calSize);
        const payload = Uint8Array.from([0, ...data26]);
        this.enqueue(encodeDebugFrame(RADIOFOUNDRY_STORAGE_COMMAND | 0x80, req.seq, payload));
        return;
      }
      if (op === STORAGE_OP_READ) {
        const addr =
          req.payload[1]! |
          (req.payload[2]! << 8) |
          (req.payload[3]! << 16) |
          (req.payload[4]! << 24);
        const len = req.payload[5]! | (req.payload[6]! << 8);
        const key = `${addr.toString(16)}:${len}`;
        let slice = this.storageReadData.get(key);
        if (!slice) {
          slice = new Uint8Array(len);
          slice.fill(0xaa);
          this.storageReadData.set(key, slice);
        }
        const body = new Uint8Array(4 + len);
        this.writeU32(body, 0, addr);
        body.set(slice, 4);
        const payload = Uint8Array.from([0, ...body]);
        this.enqueue(encodeDebugFrame(RADIOFOUNDRY_STORAGE_COMMAND | 0x80, req.seq, payload));
        return;
      }
      if (op === STORAGE_OP_CLAIM) {
        this.claimCount += 1;
        const token =
          req.payload[1]! |
          (req.payload[2]! << 8) |
          (req.payload[3]! << 16) |
          (req.payload[4]! << 24);
        const ok = token === this.chipToken;
        const payload = ok ? Uint8Array.from([0, 0]) : Uint8Array.from([7, 1]);
        this.enqueue(encodeDebugFrame(RADIOFOUNDRY_STORAGE_COMMAND | 0x80, req.seq, payload));
        return;
      }
    }
    if (req.command === CODEPLUG_COMMAND) return;
    throw new Error(`Unexpected command 0x${req.command.toString(16)}`);
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

  private writeU32(buf: Uint8Array, off: number, v: number): void {
    buf[off] = v & 0xff;
    buf[off + 1] = (v >>> 8) & 0xff;
    buf[off + 2] = (v >>> 16) & 0xff;
    buf[off + 3] = (v >>> 24) & 0xff;
  }
}

export const STORAGE_CLAIM_DM32_BOARD = {
  label: 'Baofeng DM-32UV',
  versionBoardNames: ['DM-32UV', 'DM-32', 'dm32'],
} as const;
