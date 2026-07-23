/**
 * Radio-target policies for m×n (multi-talkgroup) channel expansion.
 * Fan-out maths live in mxnExpandAll — formats only serialise projection rows.
 */

export type MxNExpansionPolicyId = 'dm32Family' | 'anytoneFamily';

export interface MxNExpansionPolicy {
  id: MxNExpansionPolicyId;
  /**
   * When true, skip RX-list fan-out if the DMR profile already has both
   * `contactRef` and `rxGroupListId` (DM32 / NeonPlug family).
   */
  skipWhenContactAndRxList: boolean;
  /** RX group list names that never expand (e.g. CPS `ALL` sentinel). */
  nonExpandableRxGroupListNames: readonly string[];
  /**
   * When true, copy member `timeSlotOverride` onto the expanded row's mode profile
   * (Anytone CPS; also correct per domain multi-talkgroup rules).
   */
  applyMemberTimeslotOverride: boolean;
  /**
   * When true and the channel has DMR + analogue profiles, emit a single lean DMR
   * row instead of multi-mode fan-out (DM32 / NeonPlug dual-mode CPS behaviour).
   */
  collapseDualModeToDmrLean: boolean;
}

const DM32_FAMILY_POLICY: MxNExpansionPolicy = {
  id: 'dm32Family',
  skipWhenContactAndRxList: true,
  nonExpandableRxGroupListNames: ['ALL'],
  applyMemberTimeslotOverride: true,
  collapseDualModeToDmrLean: true,
};

const ANYTONE_FAMILY_POLICY: MxNExpansionPolicy = {
  id: 'anytoneFamily',
  skipWhenContactAndRxList: false,
  nonExpandableRxGroupListNames: [],
  applyMemberTimeslotOverride: true,
  collapseDualModeToDmrLean: false,
};

/** Radio targets with MxNChannelExpansion → expansion policy. */
const POLICY_BY_RADIO_TARGET: Readonly<Record<string, MxNExpansionPolicy>> = {
  'baofeng-dm32uv': DM32_FAMILY_POLICY,
  'anytone-at-d890uv': ANYTONE_FAMILY_POLICY,
};

export function mxnPolicyForRadioTarget(radioTargetId: string): MxNExpansionPolicy | null {
  return POLICY_BY_RADIO_TARGET[radioTargetId] ?? null;
}
