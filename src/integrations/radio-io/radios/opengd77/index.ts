/**
 * OpenGD77 / OpenUV380 family — shared codecs + DM-1701 descriptor exports for UI.
 */

export { OPENGD77_DM1701_MODEL_ID } from './hydration.ts';
export {
  summariseOpenGd77Clone,
  type OpenGd77CloneSummary,
  type OpenGd77OnRadioCounts,
  type OpenGd77RetainGroupSummary,
} from './cloneSummary.ts';
export {
  settingsRetainPreview,
  ancillaryRetainPreview,
  type OpenGd77RetainPreviewRow,
  type OpenGd77AncillaryRetainPreview,
} from './retainPreview.ts';
export {
  OPENGD77_WRITTEN_FROM_BUILD_LABELS,
  OPENGD77_DTMF_CONTACTS_WRITE_GAP,
  OPENGD77_APRS_WRITE_GAP,
} from './writeRole.ts';
export { OPENGD77_DM1701_DESCRIPTOR } from './dm1701/descriptor.ts';
