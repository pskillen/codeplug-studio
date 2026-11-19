/**
 * What an operator should do after a first Read into library (#1924). Derived from the radio target the read
 * landed in, so each radio gets its own list without per-radio branches in the UI.
 */
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import {
  firmwareVariantFor,
  listRadioTargets,
  radioTargetFor,
  radioTargetHasTrait,
} from '@core/radio-targets/index.ts';

export type ReadNextStepId = 'arrange-zones' | 'update-firmware' | 'browse-channels' | 'open-build';

export interface ReadNextStepsInput {
  /** Radio target of the build the read created or updated. */
  radioTargetId: string;
  /** Whether this site offers the firmware flasher for the radio's model. */
  firmwareFlashOffered: boolean;
}

/** Whether another firmware for the same model adds zone grouping that this target lacks. */
function modFirmwareAddsZones(radioTargetId: string): boolean {
  const target = radioTargetFor(radioTargetId);
  if (!target) return false;
  return listRadioTargets().some(
    (other) =>
      other.modelId === target.modelId &&
      other.id !== target.id &&
      firmwareVariantFor(other.modelId, other.firmwareId)?.kind === 'mod' &&
      other.traits.includes(BuildCapabilityTrait.ZoneGrouping),
  );
}

/**
 * Ordered next steps; the first is the one to lead with. Never includes writing to the radio: the operator has
 * just read it and has nothing new to send yet.
 */
export function readNextSteps({
  radioTargetId,
  firmwareFlashOffered,
}: ReadNextStepsInput): ReadNextStepId[] {
  const steps: ReadNextStepId[] = [];
  const target = radioTargetFor(radioTargetId);
  if (radioTargetHasTrait(radioTargetId, BuildCapabilityTrait.ZoneGrouping)) {
    steps.push('arrange-zones');
  } else if (
    target &&
    firmwareFlashOffered &&
    firmwareVariantFor(target.modelId, target.firmwareId)?.kind === 'stock' &&
    modFirmwareAddsZones(radioTargetId)
  ) {
    steps.push('update-firmware');
  }
  steps.push('browse-channels', 'open-build');
  return steps;
}
