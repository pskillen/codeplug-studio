/**
 * The UV-5R Mini debug page's read history: reads held in memory for this tab only (gone on close or reload), each
 * labelled A, B, C… with its time, and a "download all" zip. Never written to browser storage.
 */

import { strToU8, zipSync } from 'fflate';
import { useSyncExternalStore } from 'react';

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

/** In-memory store for one tab. */
export class Uv5rMiniDebugReadStore {
  private reads: Uv5rMiniDebugRead[] = [];
  private downloadedCount = 0;
  private snapshot: { reads: readonly Uv5rMiniDebugRead[]; undownloaded: number } = {
    reads: [],
    undownloaded: 0,
  };
  private readonly listeners = new Set<() => void>();

  add(read: Uv5rMiniFullRead, readAt = new Date()): Uv5rMiniDebugRead {
    const entry: Uv5rMiniDebugRead = {
      ...read,
      label: uv5rMiniReadLabel(this.reads.length),
      readAt,
    };
    this.reads = [...this.reads, entry];
    this.emit();
    return entry;
  }

  /** Every read so far is in a downloaded zip. */
  markAllDownloaded(): void {
    this.downloadedCount = this.reads.length;
    this.emit();
  }

  getSnapshot = (): { reads: readonly Uv5rMiniDebugRead[]; undownloaded: number } => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    this.snapshot = {
      reads: this.reads,
      undownloaded: this.reads.length - this.downloadedCount,
    };
    for (const l of this.listeners) l();
  }
}

/** The page's store: lives as long as the tab, so in-app navigation keeps the reads. */
export const uv5rMiniDebugReadStore = new Uv5rMiniDebugReadStore();

export function useUv5rMiniDebugReads(store: Uv5rMiniDebugReadStore = uv5rMiniDebugReadStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
