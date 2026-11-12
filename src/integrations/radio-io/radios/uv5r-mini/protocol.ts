/**
 * UV-5R Mini CloneImageRadio — the uv17pro-family protocol plus the MM9PDY zone table.
 */

import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { CloneImageRadio, MemoryMap, ProgressFn } from '../../types.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  Uv17ProProtocol,
  type Uv17ProConnectOptions,
  type Uv17ProExtraUploadFrames,
} from '../uv17pro-family/protocol.ts';
import {
  encodeUv5rMiniZoneTable,
  MMZ1_BASE,
  MMZ1_FRAME_BYTES,
  MMZ1_SECTOR_BYTES,
  type Uv5rMiniZoneTableInput,
} from './modData/index.ts';
import {
  UV5R_MINI_ZONES_REGION_ID,
  uv5rMiniZoneRestoreFrames,
  uv5rMiniZoneTableFrameAddresses,
  type Uv5rMiniBackupRestoreProfile,
} from './zoneBackup.ts';

export type Uv5rMiniConnectOptions = Uv17ProConnectOptions;

/** Progress stage and plan label for the MM9PDY zone table frames. */
export const UV5R_MINI_ZONE_TABLE_STAGE = 'Zone table';

export class Uv5rMiniProtocol extends Uv17ProProtocol {
  private zoneIntent: Uv5rMiniZoneTableInput | null = null;
  /** The build's target for Backup and Restore: `mm9pdy` carries the zone table. Write ignores it. */
  private backupRestoreProfile: Uv5rMiniBackupRestoreProfile = 'stock';

  constructor() {
    super(UV5R_MINI_LAYOUT);
  }

  /**
   * The MM9PDY zone table for the next Write, or `null` for a stock Write. Also sets the write profile:
   * `mm9pdy` (the interlock adds 0xC000-0xCFFF) only while an intent is set.
   */
  setZoneIntent(intent: Uv5rMiniZoneTableInput | null): void {
    this.zoneIntent = intent;
    this.setWriteProfile(intent ? 'mm9pdy' : 'stock');
  }

  getZoneIntent(): Uv5rMiniZoneTableInput | null {
    return this.zoneIntent;
  }

  /** Set by the Backup / Restore service from the build's profile, before any read or write. */
  setBackupRestoreProfile(profile: Uv5rMiniBackupRestoreProfile): void {
    this.backupRestoreProfile = profile;
  }

  getBackupRestoreProfile(): Uv5rMiniBackupRestoreProfile {
    return this.backupRestoreProfile;
  }

  /**
   * MM9PDY Backup: read the table sector 0xC000-0xCFFF (64 frames). Refused on the stock profile, which never
   * reads the range.
   */
  async downloadZoneTable(
    opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
  ): Promise<Uint8Array> {
    if (this.backupRestoreProfile !== 'mm9pdy') {
      throw new RadioProtocolError('UV-5R Mini: the zone table is read on the MM9PDY target only');
    }
    const addrs = uv5rMiniZoneTableFrameAddresses();
    const sector = new Uint8Array(MMZ1_SECTOR_BYTES);
    let done = 0;
    for (const addr of addrs) {
      throwIfAborted(opts.signal);
      const block = (await this.readBlocks([addr], { signal: opts.signal })).get(addr)!;
      sector.set(block.subarray(0, MMZ1_FRAME_BYTES), addr - MMZ1_BASE);
      done += 1;
      reportProgress(
        opts.onProgress,
        {
          cur: done,
          max: addrs.length,
          msg: `Reading 0x${addr.toString(16)}`,
          stage: UV5R_MINI_ZONE_TABLE_STAGE,
        },
        opts.signal,
      );
    }
    return sector;
  }

  /** Restore runs under the Backup / Restore profile, never a Write's zone intent. */
  override async restoreFromBackup(
    archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
    opts: { regionIds: readonly string[]; onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    this.setWriteProfile(this.backupRestoreProfile);
    await super.restoreFromBackup(archive, opts);
  }

  /**
   * The zone table region: header first, then the frames that are not all `FF`. MM9PDY profile only; a stock
   * Restore that names the region is refused before any frame.
   */
  protected override restoreExtraFrames(
    archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
    regionIds: readonly string[],
  ): (Uv17ProExtraUploadFrames & { regionIds: readonly string[] }) | null {
    if (!regionIds.includes(UV5R_MINI_ZONES_REGION_ID)) return null;
    if (this.backupRestoreProfile !== 'mm9pdy') {
      throw new RadioProtocolError(
        'UV-5R Mini restore refused: the zone table restores on the MM9PDY target only. Nothing was written.',
      );
    }
    return {
      stage: UV5R_MINI_ZONE_TABLE_STAGE,
      frames: uv5rMiniZoneRestoreFrames(archive.manifest, archive.image),
      regionIds: [UV5R_MINI_ZONES_REGION_ID],
    };
  }

  protected override extraUploadFrames(): Uv17ProExtraUploadFrames | null {
    if (!this.zoneIntent) return null;
    const { frames } = encodeUv5rMiniZoneTable(this.zoneIntent);
    return { stage: UV5R_MINI_ZONE_TABLE_STAGE, frames };
  }
}

export function createUv5rMiniProtocol(): CloneImageRadio {
  return new Uv5rMiniProtocol();
}
