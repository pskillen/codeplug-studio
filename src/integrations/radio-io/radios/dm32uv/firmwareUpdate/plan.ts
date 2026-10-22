/**
 * DM-32UV firmware frame plan: a byte-exact port of `build_plan` in the firmware project's
 * `tools/flash/dm32_fw_send.py`. Every frame of the session is precomputed here; the guard then allows exactly the
 * next one. The 0x100-byte image header is never sent.
 */
import {
  DM32UV_FIRMWARE_HEADER_LEN,
  DM32UV_FIRMWARE_MODEL_ID,
} from '@core/radios/baofeng/dm-32uv/firmware.ts';

import type { FirmwareFlashPhase } from '../../../firmware/types.ts';
import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  DM32_FW_ACK,
  DM32_FW_BLOCK0_LEN,
  DM32_FW_BLOCK_BIG,
  DM32_FW_BLOCK_SMALL,
  DM32_FW_CRC_CHAR,
  DM32_FW_EOT,
  DM32_FW_INIT,
  DM32_FW_MODEL_QUERY,
  DM32_FW_MODEL_QUERY_REPLY,
  DM32_FW_PAD,
  DM32_FW_PRELUDE_31,
  DM32_FW_PRELUDE_45,
  DM32_FW_SOH,
  DM32_FW_STX,
  DM32_FW_TIMEOUT_MS,
} from './constants.ts';
import { crc16Xmodem } from './crc16Xmodem.ts';

export interface Dm32PlanStep {
  readonly name: string;
  readonly tx: Uint8Array;
  /** null = read 1 byte and ignore it (EOT). */
  readonly rx: Uint8Array | null;
  readonly timeoutMs: number;
  readonly phase: FirmwareFlashPhase;
  /** True from `block0+erase` on: sending this frame may leave the radio needing a re-flash. */
  readonly touchesRadio: boolean;
}

/** init, model-query, model-id: the non-destructive ident run by `identify()`. */
export const DM32_PRELUDE_IDENT_STEPS = 3;

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function crcBytes(data: Uint8Array): Uint8Array {
  const crc = crc16Xmodem(data);
  return Uint8Array.of((crc >> 8) & 0xff, crc & 0xff);
}

/** The bootloader's expected model-id reply (ASCII `BFUV32-V2`). */
export const DM32_FW_MODEL_ID_BYTES = ascii(DM32UV_FIRMWARE_MODEL_ID);

/** The three ident steps: init → model query → model id. Identical to `plan[0..3)` for a valid image. */
export function buildDm32IdentSteps(): Dm32PlanStep[] {
  const step = (name: string, tx: Uint8Array, rx: Uint8Array): Dm32PlanStep => ({
    name,
    tx,
    rx,
    timeoutMs: DM32_FW_TIMEOUT_MS.HANDSHAKE,
    phase: 'handshake',
    touchesRadio: false,
  });
  return [
    step('init', DM32_FW_INIT, Uint8Array.of(DM32_FW_ACK)),
    step('model-query', DM32_FW_MODEL_QUERY, DM32_FW_MODEL_QUERY_REPLY),
    step('model-id', Uint8Array.of(DM32_FW_ACK), DM32_FW_MODEL_ID_BYTES),
  ];
}

/** Block 0: `<file name>\0<body length>`, zero-padded to 0x80 bytes. */
export function buildDm32Block0(fileName: string, bodyLength: number): Uint8Array {
  const meta = concat(ascii(fileName), Uint8Array.of(0), ascii(String(bodyLength)));
  if (meta.length > DM32_FW_BLOCK0_LEN) {
    throw new RadioInterlockError('The firmware block 0 metadata is too long.');
  }
  const b0 = new Uint8Array(DM32_FW_BLOCK0_LEN);
  b0.set(meta);
  return b0;
}

/**
 * Precompute every frame. `image` is the whole .bin including its 0x100-byte header (never sent).
 * Steps 1–6 are `handshake`; `block0+erase` is `erase`; `type#n` / `block#n` are `transfer`; `eot` is `finish`.
 */
export function buildDm32FirmwarePlan(
  image: Uint8Array,
  fileName: string,
  eraseTimeoutMs: number = DM32_FW_TIMEOUT_MS.ERASE,
): Dm32PlanStep[] {
  const body = image.subarray(DM32UV_FIRMWARE_HEADER_LEN);
  const handshake = (
    name: string,
    tx: Uint8Array,
    rx: Uint8Array,
    timeoutMs: number,
  ): Dm32PlanStep => ({ name, tx, rx, timeoutMs, phase: 'handshake', touchesRadio: false });

  const steps: Dm32PlanStep[] = [
    handshake('init', DM32_FW_INIT, Uint8Array.of(DM32_FW_ACK), DM32_FW_TIMEOUT_MS.HANDSHAKE),
    handshake(
      'model-query',
      DM32_FW_MODEL_QUERY,
      DM32_FW_MODEL_QUERY_REPLY,
      DM32_FW_TIMEOUT_MS.HANDSHAKE,
    ),
    handshake(
      'model-id',
      Uint8Array.of(DM32_FW_ACK),
      image.slice(0, DM32_FW_MODEL_ID_BYTES.length),
      DM32_FW_TIMEOUT_MS.HANDSHAKE,
    ),
    handshake(
      'prelude-45',
      DM32_FW_PRELUDE_45,
      Uint8Array.of(DM32_FW_ACK),
      DM32_FW_TIMEOUT_MS.HANDSHAKE,
    ),
    handshake(
      'prelude-31',
      DM32_FW_PRELUDE_31,
      Uint8Array.of(DM32_FW_CRC_CHAR),
      DM32_FW_TIMEOUT_MS.PRELUDE_31,
    ),
    handshake(
      'soh-block0',
      Uint8Array.of(DM32_FW_SOH),
      Uint8Array.of(DM32_FW_CRC_CHAR),
      DM32_FW_TIMEOUT_MS.SOH,
    ),
  ];

  const b0 = buildDm32Block0(fileName, body.length);
  steps.push({
    name: 'block0+erase',
    tx: concat(Uint8Array.of(0x00, 0xff), b0, crcBytes(b0)),
    rx: Uint8Array.of(DM32_FW_ACK, DM32_FW_CRC_CHAR),
    timeoutMs: eraseTimeoutMs,
    phase: 'erase',
    touchesRadio: true,
  });

  let off = 0;
  let seq = 1;
  let n = 0;
  while (off < body.length) {
    const rem = body.length - off;
    const size = rem >= DM32_FW_BLOCK_BIG ? DM32_FW_BLOCK_BIG : DM32_FW_BLOCK_SMALL;
    const type = size === DM32_FW_BLOCK_BIG ? DM32_FW_STX : DM32_FW_SOH;
    const take = Math.min(size, rem);
    const blk = new Uint8Array(size).fill(DM32_FW_PAD);
    blk.set(body.subarray(off, off + take));
    if (seq > 0xff) seq = 0;
    steps.push({
      name: `type#${n}`,
      tx: Uint8Array.of(type),
      rx: Uint8Array.of(DM32_FW_CRC_CHAR),
      timeoutMs: DM32_FW_TIMEOUT_MS.DATA,
      phase: 'transfer',
      touchesRadio: true,
    });
    steps.push({
      name: `block#${n}`,
      tx: concat(Uint8Array.of(seq, 0xff - seq), blk, crcBytes(blk)),
      rx: Uint8Array.of(DM32_FW_ACK),
      timeoutMs: DM32_FW_TIMEOUT_MS.DATA,
      phase: 'transfer',
      touchesRadio: true,
    });
    off += take;
    seq += 1;
    n += 1;
  }

  steps.push({
    name: 'eot',
    tx: Uint8Array.of(DM32_FW_EOT),
    rx: null,
    timeoutMs: DM32_FW_TIMEOUT_MS.EOT,
    phase: 'finish',
    touchesRadio: true,
  });
  return steps;
}
