/**
 * The UV-5R Mini debug page's read history: reads held in memory for this tab only (gone on close or reload), each
 * labelled A, B, C… with its time, and a "download all" zip. Never written to browser storage.
 */

import { strToU8, zipSync } from 'fflate';
import { useSyncExternalStore } from 'react';
import { getDebugReadHistory, type DebugReadHistoryStore } from './radios/debugReadHistory.ts';
import { archiveUv5rMiniRead } from './radios/uv5rMiniCapture.ts';
import { hashUv5rMiniDebugSpans } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import {
  formatUv5rMiniSpanRange,
  type Uv5rMiniFullRead,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

export interface Uv5rMiniDebugRead extends Uv5rMiniFullRead {
  label: string;
  readAt: Date;
}

/** A, B, … Z, AA, AB, … */
export function uv5rMiniReadLabel(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** The read's text summary: time, ident and span hashes. */
export function uv5rMiniReadSummary(read: Uv5rMiniDebugRead): string {
  return [
    `Read ${read.label}`,
    `Time ${read.readAt.toISOString()}`,
    `F ${hex(read.ident.f)}`,
    `M ${hex(read.ident.m)}`,
    'SHA-256 of the decoded spans:',
    ...read.spans.map((s) => `${formatUv5rMiniSpanRange(s.span)} ${s.span.label}: ${s.sha256}`),
    '',
  ].join('\n');
}

/**
 * One zip of every read: per read, `<label>/raw.bin` (as sent), `<label>/decoded.bin` (XOR undone below 0xF000) and
 * `<label>/summary.txt`. The reads include the radio's calibration.
 */
export function buildUv5rMiniReadsZip(reads: readonly Uv5rMiniDebugRead[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const r of reads) {
    files[`${r.label}/raw.bin`] = r.raw;
    files[`${r.label}/decoded.bin`] = r.decoded;
    files[`${r.label}/summary.txt`] = strToU8(uv5rMiniReadSummary(r));
  }
  return zipSync(files);
}

/** Compatibility facade backed by the same archive history as the shared page. */
let instance = 0;
export class Uv5rMiniDebugReadStore {
  private readonly history: DebugReadHistoryStore;
  private previous?: ReturnType<DebugReadHistoryStore['getSnapshot']>;
  private snapshot: { reads: readonly Uv5rMiniDebugRead[]; undownloaded: number } = {
    reads: [],
    undownloaded: 0,
  };
  constructor(shared = false) {
    this.history = getDebugReadHistory({
      slug: shared ? 'uv-5r-mini' : `mini-test-${++instance}`,
      archiveModelId: 'UV-5R Mini',
    });
    this.history.subscribe(() => {
      this.previous = undefined;
      this.snapshot = { reads: [], undownloaded: 0 };
    });
  }
  add(read: Uv5rMiniFullRead, readAt = new Date()): Uv5rMiniDebugRead {
    const entry = this.history.add(archiveUv5rMiniRead(read, readAt.toISOString()));
    return this.toRead(entry);
  }
  private toRead(entry: ReturnType<DebugReadHistoryStore['add']>): Uv5rMiniDebugRead {
    const { archive } = entry;
    const decoded = archive.regions.clone!;
    return {
      label: entry.label,
      readAt: new Date(entry.readAt),
      decoded,
      raw: archive.sidecars['debug/wire.bin']!,
      ident: { f: archive.sidecars['debug/f.bin']!, m: archive.sidecars['debug/m.bin']! },
      spans: hashUv5rMiniDebugSpans(decoded),
    };
  }
  downloadIds(): readonly string[] {
    return this.history.getSnapshot().entries.map((entry) => entry.id);
  }
  markDownloaded(ids: readonly string[]): void {
    this.history.markDownloaded(ids);
  }
  markAllDownloaded(count = this.history.getSnapshot().entries.length): void {
    this.history.markDownloaded(
      this.history
        .getSnapshot()
        .entries.slice(0, count)
        .map((e) => e.id),
    );
  }
  getSnapshot = () => {
    const current = this.history.getSnapshot();
    if (current !== this.previous) {
      this.previous = current;
      this.snapshot = {
        reads: current.entries
          .filter(
            (e) =>
              e.archive.regions.clone &&
              e.archive.sidecars['debug/wire.bin'] &&
              e.archive.sidecars['debug/f.bin'] &&
              e.archive.sidecars['debug/m.bin'],
          )
          .map((e) => this.toRead(e)),
        undownloaded: current.undownloaded,
      };
    }
    return this.snapshot;
  };
  subscribe = (listener: () => void) => this.history.subscribe(listener);
}

/** The page's store: lives as long as the tab, so in-app navigation keeps the reads. */
export const uv5rMiniDebugReadStore = new Uv5rMiniDebugReadStore(true);

export function useUv5rMiniDebugReads(store: Uv5rMiniDebugReadStore = uv5rMiniDebugReadStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
