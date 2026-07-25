/**
 * Radio descriptor registry — UI and app services pick radios only via this module.
 * Add new adapters here (#624 OpenGD77, #638 DM-32UV, …).
 */

import type { RadioCompatibleProfile, RadioDescriptor } from './types.ts';
import { UV5R_MINI_DESCRIPTOR } from './radios/uv5r-mini/descriptor.ts';
import { UV21_PRO_V2_DESCRIPTOR } from './radios/uv21-pro-v2/descriptor.ts';
import { DM32UV_DESCRIPTOR } from './radios/dm32uv/descriptor.ts';
import { OPENGD77_DM1701_DESCRIPTOR } from './radios/opengd77/dm1701/descriptor.ts';
import { OPENGD77_MD9600_DESCRIPTOR } from './radios/opengd77/md9600/descriptor.ts';
import { AT_D890UV_DESCRIPTOR } from './radios/at-d890uv/descriptor.ts';
import { RT95_DESCRIPTOR } from './radios/rt95/descriptor.ts';

const DESCRIPTORS: readonly RadioDescriptor[] = [
  UV5R_MINI_DESCRIPTOR,
  UV21_PRO_V2_DESCRIPTOR,
  DM32UV_DESCRIPTOR,
  AT_D890UV_DESCRIPTOR,
  RT95_DESCRIPTOR,
  OPENGD77_DM1701_DESCRIPTOR,
  OPENGD77_MD9600_DESCRIPTOR,
];

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
