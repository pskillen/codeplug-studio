/**
 * UV-17Pro PROGRAM+R/W layout descriptors — shared by Mini and UV-21Pro V2.
 * Cite: CHIRP baofeng_uv17Pro.py; tier-3 docs under baofeng/uv-*.
 */

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
  readonly fwVerOffset: number;
  readonly fwVerLen: number;
  readonly defaultEncrsym: number;
  readonly baudRate: number;
  readonly baudRateFallback?: number;
  readonly initDelayMs: number;
  readonly clearBufferDelayMs: number;
  readonly identTimeoutMs: number;
  readonly ioTimeoutMs: number;
  readonly writeAckTimeoutMs: number;
  readonly magics: Uv17ProMagicSet;
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
}

const BLOCK_SIZE = 0x40;
const CHANNEL_SIZE = 32;
const FW_VER_OFFSET = 0x1ef0;
const FW_VER_LEN = 24;

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
  fwVerOffset: FW_VER_OFFSET,
  fwVerLen: FW_VER_LEN,
  defaultEncrsym: 1,
  baudRate: 115_200,
  baudRateFallback: 38_400,
  initDelayMs: 300,
  clearBufferDelayMs: 200,
  identTimeoutMs: 8000,
  ioTimeoutMs: 6000,
  writeAckTimeoutMs: 400,
  magics: buildUv17ProMagics(0x00, 0x01),
  ...SHARED_RETAIN,
  downcodeOffset: UV5R_MINI_DOWNCODE_OFFSET,
  downcodeSize: UV5R_MINI_MEM_TOTAL - UV5R_MINI_DOWNCODE_OFFSET,
  extraKeptRegions: [],
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
  fwVerOffset: FW_VER_OFFSET,
  fwVerLen: FW_VER_LEN,
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
