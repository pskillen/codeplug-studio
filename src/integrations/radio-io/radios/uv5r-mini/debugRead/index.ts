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
  UV5R_MINI_FULL_READ_SIZE,
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
export {
  compareUv5rMiniReads,
  type Uv5rMiniCompareLine,
  type Uv5rMiniCompareLineKind,
  type Uv5rMiniCompareResult,
} from './compare.ts';
export {
  decodeUv5rMiniCalibration,
  uv5rMiniPaAddress,
  uv5rMiniPaPointMhz,
  uv5rMiniTrimIndex,
  uv5rMiniTrimPpm,
  UV5R_MINI_BATTERY_STEPS,
  UV5R_MINI_CALIBRATION_END,
  UV5R_MINI_CALIBRATION_LAYOUT,
  UV5R_MINI_CALIBRATION_REGION,
  UV5R_MINI_CALIBRATION_START,
  UV5R_MINI_PA_LEVELS,
  UV5R_MINI_PA_ORDER,
  UV5R_MINI_PA_POINTS,
  UV5R_MINI_PA_SEGMENTS,
  UV5R_MINI_TRIM_CENTRE,
  UV5R_MINI_TRIM_MAX,
  UV5R_MINI_TRIM_PPM_PER_STEP,
  UV5R_MINI_TRIM_SPAN_PPM,
  type Uv5rMiniCalibration,
  type Uv5rMiniCalibrationBytes,
  type Uv5rMiniCalibrationKind,
  type Uv5rMiniCalibrationRange,
  type Uv5rMiniCalibrationText,
  type Uv5rMiniCalibrationValue,
  type Uv5rMiniPaLine,
  type Uv5rMiniPaSegment,
  type Uv5rMiniPaSegmentValues,
} from './calibrationLayout.ts';
