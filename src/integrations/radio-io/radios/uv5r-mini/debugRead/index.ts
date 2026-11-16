/**
 * UV-5R Mini debug read: read-only full clone read, span hashes and compare, for the `/debug/uv5r-mini` page.
 */

export {
  isUv5rMiniDebugFrameAllowed,
  Uv5rMiniDebugFrameRefusedError,
  Uv5rMiniReadOnlyPipe,
  UV5R_MINI_DEBUG_END_FRAME,
} from './frameAllowlist.ts';
export {
  decodeUv5rMiniFullRead,
  openUv5rMiniDebugSession,
  UV5R_MINI_CLONE_PLAIN_FROM,
  UV5R_MINI_F_REPLY_LENGTH,
  UV5R_MINI_FULL_READ_SIZE,
  UV5R_MINI_M_REPLY_LENGTH,
  type Uv5rMiniDebugIdent,
  type Uv5rMiniDebugSession,
  type Uv5rMiniFullRead,
} from './fullRead.ts';
export {
  formatUv5rMiniSpanRange,
  hashUv5rMiniDebugSpans,
  UV5R_MINI_DEBUG_FRAMES,
  UV5R_MINI_DEBUG_LOG_SECTORS,
  UV5R_MINI_DEBUG_SPANS,
  type Uv5rMiniDebugSpan,
  type Uv5rMiniSpanHash,
} from './spans.ts';
export { uv5rMiniSettingsView, type Uv5rMiniSettingsArchive } from './settingsView.ts';
export {
  compareUv5rMiniReads,
  type Uv5rMiniCompareLine,
  type Uv5rMiniCompareLineKind,
  type Uv5rMiniCompareResult,
} from './compare.ts';
export {
  diffUv5rMiniChannels,
  formatUv5rMiniChannelChange,
  formatUv5rMiniSpecialSlot,
  UV5R_MINI_CHANNEL_FIELDS,
  UV5R_MINI_SPECIAL_SLOTS,
  UV5R_MINI_UNMODELLED_RANGE,
  type Uv5rMiniChannelChange,
  type Uv5rMiniChannelChangeKind,
  type Uv5rMiniChannelDiff,
  type Uv5rMiniChannelField,
  type Uv5rMiniSpecialSlotDiff,
} from './channelDiff.ts';
export {
  decodeUv5rMiniCalibration,
  uv5rMiniPaAddress,
  uv5rMiniPaPointMhz,
  uv5rMiniTrimIndex,
  uv5rMiniTrimPpm,
  UV5R_MINI_BAND_LIMIT_OFFSETS,
  UV5R_MINI_BATTERY_STEPS,
  uv5rMiniBcd16,
  uv5rMiniCalibrationCounts,
  uv5rMiniRegionTable,
  UV5R_MINI_CALIBRATION_END,
  UV5R_MINI_CALIBRATION_LAYOUT,
  UV5R_MINI_CALIBRATION_REGION,
  UV5R_MINI_CALIBRATION_START,
  UV5R_MINI_PA_LEVELS,
  UV5R_MINI_PA_FRAMES,
  UV5R_MINI_PA_ORDER,
  UV5R_MINI_PA_POINTS,
  UV5R_MINI_PA_SEGMENTS,
  UV5R_MINI_TRIM_CENTRE,
  UV5R_MINI_TRIM_MAX,
  UV5R_MINI_TRIM_PPM_PER_STEP,
  UV5R_MINI_TRIM_SPAN_PPM,
  type Uv5rMiniBandLimit,
  type Uv5rMiniCalibration,
  type Uv5rMiniConfidence,
  type Uv5rMiniCalibrationBytes,
  type Uv5rMiniCalibrationKind,
  type Uv5rMiniCalibrationRange,
  type Uv5rMiniCalibrationText,
  type Uv5rMiniCalibrationValue,
  type Uv5rMiniPaFrame,
  type Uv5rMiniPaLine,
  type Uv5rMiniPaSegment,
  type Uv5rMiniPaSegmentValues,
} from './calibrationLayout.ts';
export {
  decodeUv5rMiniSettings,
  decodeUv5rMiniVfo,
  uv5rMiniFrameCounts,
  UV5R_MINI_SETTINGS_FIELDS,
  UV5R_MINI_VFO_FIELDS,
  type Uv5rMiniFrameCounts,
  type Uv5rMiniFrameField,
  type Uv5rMiniFrameFieldValue,
  type Uv5rMiniSettings,
  type Uv5rMiniVfo,
} from './settingsFrame.ts';
export {
  uv5rMiniCalibrationView,
  UV5R_MINI_CLONE_REGION_ID,
  type Uv5rMiniCalibrationArchive,
} from './calibrationView.ts';
