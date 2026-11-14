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
