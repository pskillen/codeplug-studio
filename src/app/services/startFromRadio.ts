/**
 * Facts the Start from my radio wizard (#1923) needs from the catalog and the radio-io registry. Keeps radio ids
 * and descriptors out of the route: a radio appears here once its descriptor supports Read into library.
 */
import { firmwareRadioIdForModel } from '@core/firmware/index.ts';
import {
  firmwareVariantFor,
  listRadioModels,
  listRadioTargets,
  radioModelDisplayLabel,
  radioTargetFor,
} from '@core/radio-targets/index.ts';
import { listDescriptorsForProfile } from '@integrations/radio-io';

import { listOfferedFirmwareUpdaters } from './firmwareFlashEnvGate.ts';
import { descriptorSupportsReadIntoLibrary } from './radioReadIntoLibrary.ts';

export interface ReadableRadio {
  modelId: string;
  /** "Baofeng UV-5R Mini". */
  label: string;
  /** Firmware the read understands, stock first ("Stock", "MM9PDY"). */
  firmwareLabels: readonly string[];
  /** Web Serial pathway used to open the session; the read reports the actual firmware. */
  egress: { formatId: string; profileId: string };
}

/** Radio models whose cable read can fill a library, in catalog order. */
export function listReadableRadios(): ReadableRadio[] {
  const targets = listRadioTargets();
  return listRadioModels().flatMap((model) => {
    const readable = targets
      .filter((t) => t.modelId === model.id)
      .flatMap((t) =>
        t.compatibleEgress
          .filter((e) =>
            listDescriptorsForProfile(e.formatId, e.profileId).some(
              descriptorSupportsReadIntoLibrary,
            ),
          )
          .map((e) => ({ target: t, egress: e })),
      );
    if (readable.length === 0) return [];
    const firmwareLabels = model.firmware
      .filter((fw) => readable.some((r) => r.target.firmwareId === fw.id))
      .map((fw) => fw.label);
    const first = readable[0]!;
    return [
      {
        modelId: model.id,
        label: radioModelDisplayLabel(model),
        firmwareLabels,
        egress: { formatId: first.egress.formatId, profileId: first.egress.profileId },
      },
    ];
  });
}

/** Default project name for a radio, e.g. "My UV-5R Mini". */
export function suggestedProjectName(radio: ReadableRadio): string {
  const model = listRadioModels().find((m) => m.id === radio.modelId);
  return `My ${model?.label ?? radio.label}`;
}

/** Whether this site offers the firmware flasher for the target's hardware model. */
export function firmwareFlashOfferedForTarget(radioTargetId: string, buildEnv?: string): boolean {
  const target = radioTargetFor(radioTargetId);
  const radioId = target ? firmwareRadioIdForModel(target.modelId) : undefined;
  if (!radioId) return false;
  return listOfferedFirmwareUpdaters(buildEnv).some((d) => d.radioId === radioId);
}

/** Display label of a target's firmware ("Stock", "MM9PDY"). */
export function firmwareLabelForTarget(radioTargetId: string): string | undefined {
  const target = radioTargetFor(radioTargetId);
  return target ? firmwareVariantFor(target.modelId, target.firmwareId)?.label : undefined;
}

/** Label of the modded firmware for the target's model ("MM9PDY"), if the catalog lists one. */
export function modFirmwareLabelForTarget(radioTargetId: string): string | undefined {
  const target = radioTargetFor(radioTargetId);
  const model = target ? listRadioModels().find((m) => m.id === target.modelId) : undefined;
  return model?.firmware.find((fw) => fw.kind === 'mod')?.label;
}
