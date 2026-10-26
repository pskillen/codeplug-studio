/**
 * AT-D890UV range change (Radio tools). Exports the session, verifier, frame builder, and errors.
 *
 * Deliberately NOT exported: the sender (`rangeChangeSend.ts`) and `AT_D890_RANGE_CHANGE_EXTENT`. The sender is
 * the only code that writes LocalInfo and is reached only through the session
 * (see rangeChangeBoundary.test.ts).
 */

export {
  AtD890RangeChangeRefusedError,
  buildAtD890RangeChangeFrame,
  type AtD890RangeChangeRefusalReason,
} from './rangeChangeFrame.ts';
export {
  AtD890RangeChangeSessionError,
  changeAtD890FrequencyRange,
  type AtD890RangeChangeFailure,
  type AtD890RangeChangeOptions,
  type AtD890RangeChangeResult,
} from './rangeChangeSession.ts';
export {
  verifyAtD890RangeChange,
  type AtD890RangeChangeVerifyOptions,
  type AtD890RangeChangeVerifyResult,
} from './rangeChangeVerify.ts';
