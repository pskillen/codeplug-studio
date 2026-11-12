/**
 * UV-5R Mini CloneImageRadio — the uv17pro-family protocol plus the MM9PDY zone table.
 */

import type { CloneImageRadio } from '../../types.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  Uv17ProProtocol,
  type Uv17ProConnectOptions,
  type Uv17ProExtraUploadFrames,
} from '../uv17pro-family/protocol.ts';
import { encodeUv5rMiniZoneTable, type Uv5rMiniZoneTableInput } from './modData/index.ts';

export type Uv5rMiniConnectOptions = Uv17ProConnectOptions;

/** Progress stage and plan label for the MM9PDY zone table frames. */
export const UV5R_MINI_ZONE_TABLE_STAGE = 'Zone table';

export class Uv5rMiniProtocol extends Uv17ProProtocol {
  private zoneIntent: Uv5rMiniZoneTableInput | null = null;

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

  protected override extraUploadFrames(): Uv17ProExtraUploadFrames | null {
    if (!this.zoneIntent) return null;
    const { frames } = encodeUv5rMiniZoneTable(this.zoneIntent);
    return { stage: UV5R_MINI_ZONE_TABLE_STAGE, frames };
  }
}

export function createUv5rMiniProtocol(): CloneImageRadio {
  return new Uv5rMiniProtocol();
}
