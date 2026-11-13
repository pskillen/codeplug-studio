/**
 * UV-17Pro PROGRAM+R/W layout descriptors — shared by Mini and UV-21Pro V2.
 * Cite: CHIRP baofeng_uv17Pro.py; tier-3 docs under baofeng/uv-*.
 */

import { assertUv5rMiniWriteAllowed } from '../uv5r-mini/writeInterlock.ts';
import { buildUv17ProMagics, type Uv17ProMagicSet } from './magics.ts';

export interface Uv17ProRetainRegion {
  id: string;
  label: string;
  packedOffset: number;
  sizeBytes: number;
}

export interface Uv17ProLayout {
  readonly radioModelId: string;
  readonly ident: Uint8Array;
  readonly modelHints: readonly string[];
  readonly protocolLabel: string;
  readonly memStarts: readonly number[];
  readonly memSizes: readonly number[];
  readonly memTotal: number;
  readonly channelCount: number;
  readonly channelSize: number;
  readonly channelSpan: number;
  readonly blockSize: number;
  readonly cloneBlockCount: number;
  /**
   * Offset of a firmware version string in the packed image, when the layout has one outside the channel
   * records. Unset on the UV-5R Mini and UV-21Pro V2: CHIRP's `_fw_ver_start` (`0x1EF0`) falls inside their
   * channel span (the second half of slot 248 and the RX/TX of slot 249), so it is channel data, not a string.
   */
  readonly fwVerOffset?: number;
  readonly fwVerLen?: number;
  readonly defaultEncrsym: number;
  readonly baudRate: number;
  readonly baudRateFallback?: number;
  readonly initDelayMs: number;
  readonly clearBufferDelayMs: number;
  readonly identTimeoutMs: number;
  readonly ioTimeoutMs: number;
  readonly writeAckTimeoutMs: number;
  /**
   * How long after the last completed exchange the protocol trusts the radio's clone session to be live.
   * Past this, Write and Restore redo the handshake before the first `W`, because a radio that has ended its
   * session drops `W` frames without a reply. Unset: the session is trusted for as long as it is held.
   */
  readonly sessionIdleMs?: number;
  /**
   * With `sessionIdleMs`: how long after the last exchange the radio has surely ended its session. A re-handshake
   * waits until then, because a radio still in its session ignores a second ident. Defaults to `sessionIdleMs`.
   */
  readonly sessionEndedAfterMs?: number;
  readonly magics: Uv17ProMagicSet;
  /**
   * When set, the 15-byte reply to the `M` magic must start with these bytes (ASCII model name),
   * or the handshake refuses before any write.
   */
  readonly modelReplyPrefix?: Uint8Array;
  readonly vfoAOffset: number;
  readonly vfoBOffset: number;
  readonly vfoSize: number;
  readonly settingsOffset: number;
  readonly settingsSize: number;
  readonly aniOffset: number;
  readonly aniSize: number;
  readonly pttIdOffset: number;
  readonly pttIdSize: number;
  readonly upcodeOffset: number;
  readonly upcodeSize: number;
  readonly downcodeOffset: number;
  readonly downcodeSize: number;
  /** Extra kept regions after the standard manifest (e.g. UV-21 fourth MEM block). */
  readonly extraKeptRegions: readonly Uv17ProRetainRegion[];
  /**
   * Optional write interlock, called for the whole plan before the first frame and again before each
   * block. Throws to refuse. Unset on layouts without one.
   */
  readonly assertWriteAllowed?: (address: number, length: number, ctx: Uv17ProWriteContext) => void;
}

export interface Uv17ProWriteContext {
  profile: 'stock' | 'mm9pdy';
  operation: 'write' | 'restore';
}

const BLOCK_SIZE = 0x40;
const CHANNEL_SIZE = 32;

const SHARED_RETAIN = {
  vfoAOffset: 0x8000,
  vfoBOffset: 0x8020,
  vfoSize: 32,
  settingsOffset: 0x8040,
  settingsSize: 64,
  aniOffset: 0x8080,
  aniSize: 0x20,
  pttIdOffset: 0x80a0,
  pttIdSize: 0x140,
  upcodeOffset: 0x81e0,
  upcodeSize: 0x30,
} as const;

function cloneBlockCount(memSizes: readonly number[]): number {
  return memSizes.reduce((sum, n) => sum + n / BLOCK_SIZE, 0);
}

const UV5R_MINI_MEM_STARTS = [0x0000, 0x9000, 0xa000] as const;
const UV5R_MINI_MEM_SIZES = [0x8040, 0x0040, 0x01c0] as const;
const UV5R_MINI_MEM_TOTAL = 0x8240;
const UV5R_MINI_CHANNEL_COUNT = 999;
const UV5R_MINI_CHANNEL_SPAN = UV5R_MINI_CHANNEL_COUNT * CHANNEL_SIZE;
const UV5R_MINI_DOWNCODE_OFFSET = 0x8210;

export const UV5R_MINI_LAYOUT: Uv17ProLayout = {
  radioModelId: 'UV5R-Mini',
  ident: new TextEncoder().encode('PROGRAMCOLORPROU'),
  modelHints: ['UV5R-Mini', 'UV-5R Mini'],
  protocolLabel: 'UV-5R Mini',
  memStarts: UV5R_MINI_MEM_STARTS,
  memSizes: UV5R_MINI_MEM_SIZES,
  memTotal: UV5R_MINI_MEM_TOTAL,
  channelCount: UV5R_MINI_CHANNEL_COUNT,
  channelSize: CHANNEL_SIZE,
  channelSpan: UV5R_MINI_CHANNEL_SPAN,
  blockSize: BLOCK_SIZE,
  cloneBlockCount: cloneBlockCount(UV5R_MINI_MEM_SIZES),
  defaultEncrsym: 1,
  baudRate: 115_200,
  baudRateFallback: 38_400,
  initDelayMs: 300,
  clearBufferDelayMs: 200,
  identTimeoutMs: 8000,
  ioTimeoutMs: 6000,
  writeAckTimeoutMs: 400,
  // The Mini's firmware ends a clone session about 2 s after the last byte it receives (decoded, not yet seen on a
  // radio). Trust it for 1.5 s; a re-handshake waits 2.5 s from the last exchange so the old session is surely over.
  sessionIdleMs: 1500,
  sessionEndedAfterMs: 2500,
  magics: buildUv17ProMagics(0x00, 0x01),
  modelReplyPrefix: new TextEncoder().encode('5RMINI'),
  ...SHARED_RETAIN,
  downcodeOffset: UV5R_MINI_DOWNCODE_OFFSET,
  downcodeSize: UV5R_MINI_MEM_TOTAL - UV5R_MINI_DOWNCODE_OFFSET,
  extraKeptRegions: [],
  assertWriteAllowed: assertUv5rMiniWriteAllowed,
};

const UV21_MEM_STARTS = [0x0000, 0x9000, 0xa000, 0xd000] as const;
const UV21_MEM_SIZES = [0x8040, 0x0040, 0x02c0, 0x0040] as const;
const UV21_MEM_TOTAL = 0x8380;
const UV21_CHANNEL_COUNT = 1000;
const UV21_CHANNEL_SPAN = UV21_CHANNEL_COUNT * CHANNEL_SIZE;
const UV21_DOWNCODE_OFFSET = 0x8210;
const UV21_FOURTH_REGION_OFFSET = 0x8340;

export const UV21_PRO_V2_LAYOUT: Uv17ProLayout = {
  radioModelId: 'UV21ProV2',
  ident: new TextEncoder().encode('PROGRAMBFNORMALU'),
  modelHints: ['UV21ProV2', 'UV-21Pro V2'],
  protocolLabel: 'UV-21Pro V2',
  memStarts: UV21_MEM_STARTS,
  memSizes: UV21_MEM_SIZES,
  memTotal: UV21_MEM_TOTAL,
  channelCount: UV21_CHANNEL_COUNT,
  channelSize: CHANNEL_SIZE,
  channelSpan: UV21_CHANNEL_SPAN,
  blockSize: BLOCK_SIZE,
  cloneBlockCount: cloneBlockCount(UV21_MEM_SIZES),
  defaultEncrsym: 1,
  baudRate: 115_200,
  initDelayMs: 300,
  clearBufferDelayMs: 200,
  identTimeoutMs: 8000,
  ioTimeoutMs: 6000,
  writeAckTimeoutMs: 400,
  magics: buildUv17ProMagics(0x00, 0x00),
  ...SHARED_RETAIN,
  downcodeOffset: UV21_DOWNCODE_OFFSET,
  downcodeSize: UV21_FOURTH_REGION_OFFSET - UV21_DOWNCODE_OFFSET,
  extraKeptRegions: [
    {
      id: 'memRegion4',
      label: 'Fourth memory region',
      packedOffset: UV21_FOURTH_REGION_OFFSET,
      sizeBytes: 0x40,
    },
  ],
};
