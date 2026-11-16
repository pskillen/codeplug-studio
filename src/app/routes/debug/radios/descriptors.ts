import type { ComponentType } from 'react';
import { OPENGD77_SETTINGS_GAP_LENGTH } from '@integrations/radio-io/radios/opengd77/constants.ts';
import { Dm32Calibration } from './Dm32Calibration.tsx';
import { OpenGd77Calibration } from './OpenGd77Calibration.tsx';
import { OpenGd77Memory } from './OpenGd77Memory.tsx';
import { openGd77SettingsView } from '@integrations/radio-io/radios/opengd77/debugSettingsView.ts';
import { AtD890Memory } from './AtD890Memory.tsx';
import { Dm32Memory } from './Dm32Memory.tsx';
import { dm32SettingsView } from '@integrations/radio-io/radios/dm32uv/debugSettingsView.ts';
import { rt95SettingsView } from '@integrations/radio-io/radios/rt95/debugSettingsView.ts';
import { atD890SettingsView } from '@integrations/radio-io/radios/at-d890uv/debugSettingsView.ts';
import type { CalibrationView, SettingsView } from '@integrations/radio-io/debugView/index.ts';
import { rt95CalibrationView } from '@integrations/radio-io/radios/rt95/debugCalibrationView.ts';
import { Rt95MemoryView } from './Rt95Memory.tsx';
import { Uv5rMiniMemory } from './Uv5rMiniMemory.tsx';
import { UV5R_MINI_MEMORY_NOT_DECODED } from '@integrations/radio-io/radios/uv5r-mini/debugRead/memoryText.ts';
import { uv5rMiniSettingsView } from '@integrations/radio-io/radios/uv5r-mini/debugRead/settingsView.ts';
import { AtD890Calibration } from './AtD890Calibration.tsx';
import { AtD890Compare } from './AtD890Compare.tsx';
import { atD890CompareAdapter } from './atD890Compare.ts';
import { atD890DecodedSnapshot } from './atD890DecodedDiff.ts';
import type { DebugCompareAdapter } from '@integrations/radio-io/debugCompare/index.ts';
import { dm32CompareAdapter } from '@integrations/radio-io/radios/dm32uv/debugCompare.ts';
import { openGd77CompareAdapter } from '@integrations/radio-io/radios/opengd77/debugCompare.ts';
import { rt95CompareAdapter } from '@integrations/radio-io/radios/rt95/debugCompare.ts';
import { uv5rMiniCompareAdapter } from '@integrations/radio-io/radios/uv5r-mini/debugRead/compare.ts';
import { captureAtD890 } from './atD890Capture.ts';
import { captureDm32 } from './dm32Capture.ts';
import { captureUv5rMini } from './uv5rMiniCapture.ts';
import { captureRt95, RT95_CAPTURE_STAGES } from './rt95Capture.ts';
import { captureOpenGd77, OPENGD77_DEBUG_USER_DATABASE_OPTION } from './opengd77Capture.ts';
import { openGd77IdentityRows } from './opengd77Identity.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import type { DebugArchive } from './captureArchive.ts';
import type { DebugSensitiveRangesFn } from '@integrations/radio-io/debugSensitive.ts';
import { openGd77ArchiveSensitiveRanges } from '@integrations/radio-io/radios/opengd77/debugSensitive.ts';
import { atD890ArchiveSensitiveRanges } from '@integrations/radio-io/radios/at-d890uv/debugPasswords.ts';
import { dm32ArchiveSensitiveRanges } from '@integrations/radio-io/radios/dm32uv/debugSensitive.ts';
import { rt95ArchiveSensitiveRanges } from '@integrations/radio-io/radios/rt95/debugSensitive.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';

export type DebugCalibrationProps = { archive?: DebugArchive; overlayArchive?: DebugArchive };
export type DebugCompareExtraProps = { first: DebugArchive; second: DebugArchive };

/** Options a capture takes, by option id; unticked options are `false` or absent. */
export type RadioDebugCaptureOptions = Readonly<Record<string, boolean>>;

export type RadioDebugCapture = (opts?: {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
  options?: RadioDebugCaptureOptions;
}) => Promise<DebugArchive>;

/** A tick box on the Backup tab that changes what Read radio reads. Unticked by default. */
export interface RadioDebugCaptureOption {
  id: string;
  label: string;
  description: string;
}

/** Selected profiles describe expectations, never observed radio identity. */
export interface RadioDebugDescriptor {
  slug: string;
  model: string;
  archiveModelId: string;
  capture?: RadioDebugCapture;
  /** Tick boxes shown above Read radio; each is passed to `capture` as `options[id]`. */
  captureOptions?: readonly RadioDebugCaptureOption[];
  /** The `stage` labels a Read goes through, in order; shown as "Stage i of n" beside the progress bar. */
  captureStages?: readonly string[];
  Calibration?: ComponentType<DebugCalibrationProps>;
  /** Extra panel under the shared compare for what only this radio has (D890 acquisition claims). */
  CompareExtra?: ComponentType<DebugCompareExtraProps>;
  /** Byte compare for this radio: sections, region identity and limits notes. Radio-home code. */
  compare?: DebugCompareAdapter;
  /** A profile's own Memory viewer; without one the generic Memory viewer is used. */
  Memory?: ComponentType<{ archive?: DebugArchive; notDecoded?: readonly string[] }>;
  /** Memory categories this radio does not decode yet; named in one line under the Category dropdown. */
  memoryNotDecoded?: readonly string[];
  /**
   * Password bytes in one archive region, masked in Hex and Compare until revealed. Radio-home
   * function; it returns nothing for another radio's archive. Absent: nothing to mask.
   */
  sensitiveRanges?: DebugSensitiveRangesFn;
  /**
   * The Settings tab's content as a radio-neutral view, drawn by the shared `SettingsTable`.
   * Radio-home function; absent: no Settings tab.
   */
  settings?: (archive: DebugArchive) => SettingsView;
  /**
   * The Calibration tab's content as a radio-neutral view, drawn by the shared `CalibrationTab`
   * Radio-home function, called once for the read and once for the overlay. Preferred over
   * `Calibration`.
   */
  calibration?: (archive: DebugArchive) => CalibrationView;
  /** False when the Calibration tab has no overlay picker (the radio's calibration is shown alone). */
  calibrationOverlay?: boolean;
  /** Keep every read and opened archive in the shared tab-only history, with Compare. */
  readHistory?: boolean;
  family: string;
  capabilities: readonly RadioDebugCapability[];
  /** Overview rows after `Model · selected`, for a profile with its own identity evidence. */
  identityRows?: (input: {
    archive?: DebugArchive;
    connection: string;
  }) => readonly (readonly [string, string])[];
  /** Caption under the identity grid, after the generic sentence. */
  identityNote?: string;
  /** Backup-tab notice about what the read sends and how to recover. */
  readNotice?: { title: string; text: string };
}

export type RadioDebugCapabilityStatus = 'Available' | 'Partial' | 'Not yet available';

export interface RadioDebugCapability {
  name: 'Backup' | 'Calibration' | 'Memory';
  status: RadioDebugCapabilityStatus;
}

const capabilities = (
  backup: RadioDebugCapabilityStatus,
  calibration: RadioDebugCapabilityStatus,
  memory: RadioDebugCapabilityStatus,
): readonly RadioDebugCapability[] => [
  { name: 'Backup', status: backup },
  { name: 'Calibration', status: calibration },
  { name: 'Memory', status: memory },
];

const unavailable = capabilities('Not yet available', 'Not yet available', 'Not yet available');

/** Badge colour for a capability status. */
export const capabilityColor = (status: RadioDebugCapabilityStatus) =>
  status === 'Available' ? 'green' : status === 'Partial' ? 'yellow' : 'gray';

const OPENGD77_IDENTITY_NOTE =
  'Values are the captured FirmwareInfo reply, as reported. A revision string is not proof of provenance. The reply has no serial and cannot tell stock builds from forks or mods. Radio type does not distinguish DM-1701 from RT-84 or MD-9600 from RT-90.';

const OPENGD77_READ_NOTICE = {
  title: 'Read-only capture and recovery',
  text: `The capture only reads: it sends a ping, the FirmwareInfo request, the CPS screen command, reads of the registered flash spans and the ${OPENGD77_SETTINGS_GAP_LENGTH}-byte settings struct tail, the occupied User Database when ticked, and the CPS close. It takes minutes, and a large User Database makes it much longer. Cancel stops at the next frame and sends only the CPS close. If the radio stays on the CPS screen after a failure, power-cycle it.`,
};

const OPENGD77_CAPTURE_OPTIONS: readonly RadioDebugCaptureOption[] = [
  {
    id: OPENGD77_DEBUG_USER_DATABASE_OPTION,
    label: 'Also read the User Database',
    description:
      'The DMR ID lookup list. It can be up to about 14 MB and add many minutes to the read. Unticked, only that region is skipped.',
  },
];

export const radioDebugDescriptors: readonly RadioDebugDescriptor[] = [
  {
    slug: 'at-d890uv',
    // Hooked here, not in atD890Compare.ts: the snapshot's imports reach back into this module.
    compare: { ...atD890CompareAdapter, decoded: atD890DecodedSnapshot },
    Memory: AtD890Memory,
    settings: atD890SettingsView,
    Calibration: AtD890Calibration,
    CompareExtra: AtD890Compare,
    readHistory: true,
    capture: captureAtD890,
    sensitiveRanges: atD890ArchiveSensitiveRanges,
    model: 'AT-D890UV',
    archiveModelId: 'AT-D890UV',
    family: 'AnyTone · stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'dm-32uv',
    compare: dm32CompareAdapter,
    Memory: Dm32Memory,
    settings: dm32SettingsView,
    calibrationOverlay: false,
    Calibration: Dm32Calibration,
    readHistory: true,
    capture: captureDm32,
    sensitiveRanges: dm32ArchiveSensitiveRanges,
    model: 'DM-32UV',
    archiveModelId: 'DM-32UV',
    family: 'Baofeng · stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'dm-32uv-radiofoundry',
    model: 'DM-32UV',
    archiveModelId: 'DM-32UV-RadioFoundry',
    family: 'RadioFoundry',
    capabilities: unavailable,
  },
  {
    slug: 'dm-1701-opengd77',
    compare: openGd77CompareAdapter,
    Calibration: OpenGd77Calibration,
    Memory: OpenGd77Memory,
    settings: openGd77SettingsView,
    readHistory: true,
    sensitiveRanges: openGd77ArchiveSensitiveRanges,
    capture: captureOpenGd77(OPENGD77_DM1701_MODEL_ID),
    captureOptions: OPENGD77_CAPTURE_OPTIONS,
    model: 'DM-1701',
    archiveModelId: 'DM-1701',
    family: 'OpenGD77',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
    identityRows: openGd77IdentityRows,
    identityNote: OPENGD77_IDENTITY_NOTE,
    readNotice: OPENGD77_READ_NOTICE,
  },
  {
    slug: 'md-9600-opengd77',
    compare: openGd77CompareAdapter,
    Calibration: OpenGd77Calibration,
    Memory: OpenGd77Memory,
    settings: openGd77SettingsView,
    readHistory: true,
    sensitiveRanges: openGd77ArchiveSensitiveRanges,
    capture: captureOpenGd77(OPENGD77_MD9600_MODEL_ID),
    captureOptions: OPENGD77_CAPTURE_OPTIONS,
    model: 'MD-9600',
    archiveModelId: 'MD-9600',
    family: 'OpenGD77',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
    identityRows: openGd77IdentityRows,
    identityNote: OPENGD77_IDENTITY_NOTE,
    readNotice: OPENGD77_READ_NOTICE,
  },
  {
    slug: 'rt95',
    compare: rt95CompareAdapter,
    Memory: Rt95MemoryView,
    settings: rt95SettingsView,
    calibration: rt95CalibrationView,
    readHistory: true,
    capture: captureRt95,
    sensitiveRanges: rt95ArchiveSensitiveRanges,
    captureStages: RT95_CAPTURE_STAGES,
    model: 'RT95',
    archiveModelId: 'retevis-rt95',
    family: 'Stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'uv-21-pro-v2',
    model: 'UV-21 Pro V2',
    archiveModelId: 'UV-21Pro V2',
    family: 'Stock family',
    capabilities: unavailable,
  },
  {
    slug: 'uv-5r-mini',
    compare: uv5rMiniCompareAdapter,
    Memory: Uv5rMiniMemory,
    memoryNotDecoded: UV5R_MINI_MEMORY_NOT_DECODED,
    settings: uv5rMiniSettingsView,
    readHistory: true,
    capture: captureUv5rMini,
    model: 'UV-5R Mini',
    archiveModelId: 'UV-5R Mini',
    family: 'Stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
];

/** The page's tab labels, in order: Settings follows Memory for a radio that has a Settings view. */
export const radioDebugTabs = (descriptor: Pick<RadioDebugDescriptor, 'settings'>): string[] => [
  'Overview',
  'Backup',
  'Calibration',
  'Memory',
  ...(descriptor.settings ? ['Settings'] : []),
  'Hex',
  'Compare',
  'Trace',
];
