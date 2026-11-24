import type { EgressPath } from '@core/models/egressPath.ts';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import { programHoldSafeMs } from '@integrations/radio-io/programHold.ts';
import { radioIoProfileSupportsRadioSettings } from '../../lib/radioIoRadioSettingsSupport.ts';
import {
  getSatelliteKepsWriteAdapter,
  hasSatelliteKepsWriteAdapter,
  satelliteKepsSameSessionAfterUpload,
  type SatelliteKepsWriteFn,
} from '../satelliteKepsWriteAdapters.ts';
import type { WritePartSupport } from '../../components/builds/RadioWriteStepper/writeParts.ts';

export type ContactStoreKind =
  | 'shared-contact-bank'
  | 'shared-address-book'
  | 'separate-lookup-database'
  | 'generic';

export interface WriteShellOptions {
  radioLabel: string;
  parts: WritePartSupport;
  contactStore: ContactStoreKind;
  readPlan: boolean;
  programHoldSafeMs: number;
  /** 0 = the radio does not restart after END. */
  restartAfterEndSeconds: number;
  check: { available: boolean; reportLabels?: { keptSectionTitle: string; keptSummaryLabel: string } };
  keps?: { writeFn: SatelliteKepsWriteFn; session: 'same' | 'after-restart' };
  successNote?: string;
}

export function resolveWriteShellOptions(
  egress: EgressPath,
  descriptor: RadioDescriptor | undefined,
): WriteShellOptions {
  const profileId = egress.profileId;
  const traitProfile = traitProfileFor(profileId);
  const contacts = Boolean(
    traitProfile?.traits.includes(BuildCapabilityTrait.SeparateDigitalIdList),
  );
  const kepsAdapter = getSatelliteKepsWriteAdapter(profileId);
  const kepsOffered = hasSatelliteKepsWriteAdapter(profileId);
  const sameSession = satelliteKepsSameSessionAfterUpload(profileId);

  return {
    radioLabel: descriptor?.label ?? 'radio',
    parts: {
      contacts,
      keps: kepsOffered,
      settings: radioIoProfileSupportsRadioSettings(profileId),
    },
    contactStore: descriptor?.contactStore ?? 'generic',
    readPlan: typeof descriptor?.planStages === 'function',
    programHoldSafeMs: programHoldSafeMs(descriptor ?? {}),
    restartAfterEndSeconds: descriptor?.restartAfterEnd?.seconds ?? 0,
    check: {
      available: Boolean(descriptor?.writeVerify),
      reportLabels: descriptor?.writeVerify?.reportLabels,
    },
    keps:
      kepsOffered && kepsAdapter
        ? {
            writeFn: kepsAdapter,
            session: sameSession ? 'same' : 'after-restart',
          }
        : undefined,
    successNote: descriptor?.successNote,
  };
}