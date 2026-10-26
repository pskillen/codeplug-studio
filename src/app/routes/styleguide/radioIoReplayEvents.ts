/**
 * Progress event streams in the shapes real Writes emit, for the styleguide replay demo and the
 * progress window tests (#1393). Labels and the order, repeats, `cur` restarts and `cur` 0 seed
 * events follow the adapters' `onProgress` calls (DM-32UV `protocol.ts` download and upload,
 * OpenGD77 session read plus `upload()` read, D890 download list, erase-unit preserve, Upload and
 * the keps writer's second Upload). No codeplug data: counts only.
 */

import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

export type ReplayRadioId = 'at-d890uv' | 'dm32uv' | 'opengd77' | 'rt95';

const D890_DOWNLOAD_STAGES = [
  'Local info',
  'Optional settings / alarm',
  'APRS settings',
  'Channels',
  'Zones',
  'Scan lists',
  'Talk groups',
  'RX groups',
  'Radio IDs',
  'Master ID',
  'AM airband',
] as const;

function ev(cur: number, max: number, msg: string, stage: string): ProgressUpdate {
  return { cur, max, msg, stage };
}

/** D890: one event per download stage (`cur` is the stage index), erase-unit preserve, Upload. */
export function d890WriteEvents(
  opts: { touchedUnits?: number; uploadChunks?: number; keps?: boolean } = {},
): ProgressUpdate[] {
  const units = opts.touchedUnits ?? 6;
  const chunks = opts.uploadChunks ?? 40;
  const out: ProgressUpdate[] = D890_DOWNLOAD_STAGES.map((stage, i) =>
    ev(i, D890_DOWNLOAD_STAGES.length, `Reading ${stage}`, stage),
  );
  for (let u = 0; u < units; u++) {
    out.push(ev(u, units, `Reading erase unit ${u}…`, 'Preserving untouched settings'));
  }
  out.push(ev(0, chunks, 'Writing sparse regions…', 'Upload'));
  for (let i = 1; i <= chunks; i++) out.push(ev(i, chunks, `Writing block ${i}`, 'Upload'));
  if (opts.keps) {
    out.push(ev(0, 1, 'Reading erase unit 0…', 'Preserving untouched satellite data'));
    out.push(ev(0, 8, 'Writing satellites…', 'Upload'));
    for (let i = 1; i <= 8; i++) out.push(ev(i, 8, `Writing satellite block ${i}`, 'Upload'));
  }
  return out;
}

/**
 * DM-32UV: discover, pre-write read (per block group, `cur` restarting at 0), discover again,
 * a "Queued" `cur` 0 seed event for every group, then the real group writes.
 */
export function dm32WriteEvents(
  groups: ReadonlyArray<readonly [label: string, blocks: number]> = [
    ['Channels', 6],
    ['Zones', 2],
    ['Scan lists', 1],
    ['Talk groups', 2],
    ['Settings & other', 4],
  ],
): ProgressUpdate[] {
  const out: ProgressUpdate[] = [ev(0, 100, 'Discovering memory map…', 'Discover memory map')];
  out.push(ev(100, 100, 'Discovering memory map…', 'Discover memory map'));
  for (const [, n] of groups) {
    for (let i = 0; i <= n; i++) out.push(ev(i, n, `Reading block ${i} of ${n}`, 'Pre-write read'));
  }
  out.push(ev(0, 100, 'Discovering live memory map…', 'Discover memory map'));
  out.push(ev(100, 100, 'Discovering live memory map…', 'Discover memory map'));
  for (const [label, n] of groups) out.push(ev(0, n, `Queued ${label} (${n} blocks)`, label));
  for (const [label, n] of groups) {
    out.push(ev(0, n, `Writing ${label}…`, label));
    for (let i = 1; i <= n; i++) out.push(ev(i, n, `Writing ${label}: block ${i} of ${n}`, label));
  }
  return out;
}

/** OpenGD77: the session's read, upload()'s own read, dirty sectors, then the User Database. */
export function openGd77WriteEvents(
  opts: { sectors?: number; dirty?: number; userDb?: number } = {},
): ProgressUpdate[] {
  const sectors = opts.sectors ?? 12;
  const dirty = opts.dirty ?? 5;
  const out: ProgressUpdate[] = [];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i <= sectors; i++) {
      out.push(ev(i, sectors, `Reading sector ${i}`, 'Pre-write read'));
    }
  }
  for (let i = 1; i <= dirty; i++)
    out.push(ev(i, dirty, `Writing FLASH sector ${i}`, 'FLASH sectors'));
  const db = opts.userDb ?? 0;
  for (let i = 1; i <= db; i++)
    out.push(ev(i, db, `Writing User Database sector ${i}`, 'User Database'));
  return out;
}

/** RT95 and the UV-17Pro family: the pre-write read, then the upload. */
export function rt95WriteEvents(blocks = 20): ProgressUpdate[] {
  const out: ProgressUpdate[] = [];
  for (let i = 1; i <= blocks; i++) out.push(ev(i, blocks, `Reading ${i}`, 'Pre-write read'));
  out.push(ev(0, blocks, 'Upload handshake', 'Upload'));
  for (let i = 1; i <= blocks; i++) out.push(ev(i, blocks, `Writing ${i}`, 'Upload'));
  return out;
}

export const REPLAY_RADIOS: ReadonlyArray<{ id: ReplayRadioId; label: string }> = [
  { id: 'at-d890uv', label: 'AT-D890UV' },
  { id: 'dm32uv', label: 'DM-32UV' },
  { id: 'opengd77', label: 'OpenGD77 (DM-1701)' },
  { id: 'rt95', label: 'RT95' },
];

export function replayEventsFor(id: ReplayRadioId): ProgressUpdate[] {
  switch (id) {
    case 'at-d890uv':
      return d890WriteEvents();
    case 'dm32uv':
      return dm32WriteEvents();
    case 'opengd77':
      return openGd77WriteEvents({ userDb: 3 });
    case 'rt95':
      return rt95WriteEvents();
  }
}
