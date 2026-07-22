/**
 * Radio descriptor registry — UI and app services pick radios only via this module.
 * Add new adapters here (#624 OpenGD77, #638 DM-32UV, …).
 */

import type { RadioCompatibleProfile, RadioDescriptor } from './types.ts';
import { UV5R_MINI_DESCRIPTOR } from './radios/uv5r-mini/descriptor.ts';

const DESCRIPTORS: readonly RadioDescriptor[] = [UV5R_MINI_DESCRIPTOR];

/** All registered radio descriptors (order is UI display order). */
export function listRadioDescriptors(): readonly RadioDescriptor[] {
  return DESCRIPTORS;
}

/** Find a descriptor by any of its modelIds (case-sensitive). */
export function getRadioDescriptor(modelId: string): RadioDescriptor | undefined {
  return DESCRIPTORS.find((d) => d.modelIds.includes(modelId));
}

/** Descriptors whose compatibleProfiles include the given format/profile pair. */
export function listDescriptorsForProfile(formatId: string, profileId: string): RadioDescriptor[] {
  return DESCRIPTORS.filter((d) =>
    d.compatibleProfiles.some((p) => p.formatId === formatId && p.profileId === profileId),
  );
}

/** Whether a profile is listed on any registered descriptor. */
export function isProfileCompatibleWithAnyRadio(profile: RadioCompatibleProfile): boolean {
  return listDescriptorsForProfile(profile.formatId, profile.profileId).length > 0;
}
