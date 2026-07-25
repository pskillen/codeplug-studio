/**
 * Retain-only shallow decoders for UV-5R Mini Radio image UI.
 */

import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  settingsRetainPreview as settingsRetainPreviewFamily,
  ancillaryRetainPreview as ancillaryRetainPreviewFamily,
  type Uv17ProRetainPreviewRow,
  type Uv17ProAncillaryRetainPreview,
} from '../uv17pro-family/retainPreview.ts';

export type Uv5rMiniRetainPreviewRow = Uv17ProRetainPreviewRow;
export type Uv5rMiniAncillaryRetainPreview = Uv17ProAncillaryRetainPreview;

export function settingsRetainPreview(bytes: Uint8Array): Uv5rMiniRetainPreviewRow[] {
  return settingsRetainPreviewFamily(UV5R_MINI_LAYOUT, bytes);
}

export function ancillaryRetainPreview(bytes: Uint8Array): Uv5rMiniAncillaryRetainPreview {
  return ancillaryRetainPreviewFamily(UV5R_MINI_LAYOUT, bytes);
}
