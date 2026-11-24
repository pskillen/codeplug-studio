import type { ComponentType, ReactNode } from 'react';
import {
  OPENGD77_CAPTURE_OPTIONS,
  OPENGD77_IDENTITY_NOTE,
  OPENGD77_READ_NOTICE,
} from '@integrations/radio-io/radios/opengd77/debugText.ts';
import {
  AT_D890_IDENTITY_NOTE,
  AT_D890_READ_NOTICE,
  atD890IdentityRows,
} from '@integrations/radio-io/radios/at-d890uv/debugIdentity.ts';
import {
  DM32_IDENTITY_NOTE,
  DM32_READ_NOTICE,
  dm32IdentityRows,
} from '@integrations/radio-io/radios/dm32uv/debugIdentity.ts';
import {
  rt95IdentityRows,
  rt95RegionNote,
} from '@integrations/radio-io/radios/rt95/debugIdentity.ts';
import {
  uv5rMiniIdentityRows,
  uv5rMiniRegionNote,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/identity.ts';
import { openUv5rMiniLegacyArchive } from './uv5rMiniLegacyArchive.ts';
import { openGd77CalibrationView } from '@integrations/radio-io/radios/opengd77/debugCalibrationView.ts';
import { OpenGd77Memory } from './OpenGd77Memory.tsx';
import { openGd77SettingsView } from '@integrations/radio-io/radios/opengd77/debugSettingsView.ts';
import { AtD890Memory } from './AtD890Memory.tsx';
import { Dm32Memory } from './Dm32Memory.tsx';
import { dm32CalibrationView } from '@integrations/radio-io/radios/dm32uv/debugCalibrationView.ts';
import { dm32SettingsView } from '@integrations/radio-io/radios/dm32uv/debugSettingsView.ts';
import { rt95SettingsView } from '@integrations/radio-io/radios/rt95/debugSettingsView.ts';
import { atD890SettingsView } from '@integrations/radio-io/radios/at-d890uv/debugSettingsView.ts';
import type {
  CalibrationView,
  DebugFirmwareFamily,
  DebugIdentityRows,
  SettingsView,
} from '@integrations/radio-io/debugView/index.ts';
import {
  DEBUG_FIRMWARE_ORDER,
  isDebugFirmwareFamily,
} from '@integrations/radio-io/debugView/index.ts';
import { rt95CalibrationView } from '@integrations/radio-io/radios/rt95/debugCalibrationView.ts';
import { Rt95MemoryView } from './Rt95Memory.tsx';
import { RT95_MEMORY_NOT_DECODED } from '@integrations/radio-io/radios/rt95/debugMemoryText.ts';
import { Uv5rMiniMemory } from './Uv5rMiniMemory.tsx';
import { UV5R_MINI_MEMORY_NOT_DECODED } from '@integrations/radio-io/radios/uv5r-mini/debugRead/memoryText.ts';
import { uv5rMiniCalibrationView } from '@integrations/radio-io/radios/uv5r-mini/debugRead/calibrationView.ts';
import { uv5rMiniSettingsView } from '@integrations/radio-io/radios/uv5r-mini/debugRead/settingsView.ts';
import { atD890CalibrationView } from '@integrations/radio-io/radios/at-d890uv/debugCalibrationView.ts';
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
import { captureOpenGd77 } from './opengd77Capture.ts';
import { captureRadioFoundry } from './radioFoundryCapture.ts';
import { openGd77IdentityRows } from './opengd77Identity.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { atD890Coverage } from './coverageViews/AtD890Coverage.tsx';
import { dm32Coverage } from './coverageViews/Dm32Coverage.tsx';
import { openGd77Coverage } from './coverageViews/OpenGd77Coverage.tsx';
import { rt95Coverage } from './coverageViews/Rt95Coverage.tsx';
import { uv5rMiniCoverage, uv5rMiniExtraHexRegions } from './coverageViews/Uv5rMiniCoverage.tsx';
import { radioFoundryCoverage } from './coverageViews/RadioFoundryCoverage.tsx';
import type { DebugArchive } from './captureArchive.ts';
import type { DebugSensitiveRangesFn } from '@integrations/radio-io/debugSensitive.ts';
import { openGd77ArchiveSensitiveRanges } from '@integrations/radio-io/radios/opengd77/debugSensitive.ts';
import { atD890ArchiveSensitiveRanges } from '@integrations/radio-io/radios/at-d890uv/debugPasswords.ts';
import { dm32ArchiveSensitiveRanges } from '@integrations/radio-io/radios/dm32uv/debugSensitive.ts';
import { rt95ArchiveSensitiveRanges } from '@integrations/radio-io/radios/rt95/debugSensitive.ts';
import {
  RADIOFOUNDRY_CALIBRATION_NOTE,
  RADIOFOUNDRY_CAPTURE_OPTIONS,
  RADIOFOUNDRY_CAPTURE_STAGES,
  RADIOFOUNDRY_READ_NOTICE,
} from '@integrations/radio-io/radios/radiofoundry/debugText.ts';
import {
  RADIOFOUNDRY_IDENTITY_NOTE,
  radioFoundryIdentityRows,
} from '@integrations/radio-io/radios/radiofoundry/debugIdentity.ts';
import { radioFoundryArchiveSensitiveRanges } from '@integrations/radio-io/radios/radiofoundry/debugSensitive.ts';
import { radioFoundrySettingsView } from '@integrations/radio-io/radios/radiofoundry/debugSettingsView.ts';
import { radioFoundryCompareAdapter } from '@integrations/radio-io/radios/radiofoundry/debugCompare.ts';
import { RadioFoundryMemory } from './RadioFoundryMemory.tsx';
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

/** What the Hex and Compare views say about one region, beyond what the radio's compare adapter gives. */
export interface RadioDebugRegionNote {
  /** Replaces the compare adapter's representation line. */
  representation?: string;
  /** Sentence about what the shown addresses mean. */
  addressNote?: string;
  /** Short tag after the region label, e.g. `[body]`. */
  tag?: string;
}

/** What the Backup tab's Coverage panel says about one radio's archive. Built in the radio's own code. */
export interface RadioDebugCoverageView {
  /** Heading above each region's line; absent or `undefined`: the compare adapter's address space. */
  regionKind?: (regionId: string) => string | undefined;
  /** The word before a region's address; default `Start`. */
  startLabel?: (regionId: string) => string;
  /** True when the region line does not end with `· Captured`. */
  omitCaptured?: boolean;
  /** Extra line above the region list. */
  summary?: ReactNode;
  /** The radio's own coverage panel, under the region list. */
  body: ReactNode;
}

/** A selectable byte source in the Hex viewer that is not a manifest region (a sidecar). */
export interface RadioDebugExtraHexRegion {
  id: string;
  label: string;
  bytes: Uint8Array;
}

/** Selected profiles describe expectations, never observed radio identity. */
export interface RadioDebugDescriptor {
  slug: string;
  /** URL key for the hardware model; every descriptor of one radio shares it and its `model`. */
  radio: string;
  firmware: DebugFirmwareFamily;
  /** Other paths that show this descriptor's read history; the undownloaded-reads guard covers them too. */
  alsoGuards?: readonly string[];
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
  /**
   * The Backup tab's Coverage panel for this radio's archive: region headings and a body. Absent,
   * or `undefined` for an archive it cannot describe: the generic "expected map not yet defined".
   */
  coverage?: (archive: DebugArchive) => RadioDebugCoverageView | undefined;
  /** Extra Hex viewer entries after the manifest regions, shown from byte 0 and never masked. */
  extraHexRegions?: (archive: DebugArchive) => readonly RadioDebugExtraHexRegion[];
  /** Keep every read and opened archive in the shared tab-only history, with Compare. */
  readHistory?: boolean;
  family: string;
  capabilities: readonly RadioDebugCapability[];
  /** Overview rows after `Model · selected`, for a profile with its own identity evidence. */
  identityRows?: (input: {
    archive?: DebugArchive;
    connection: string;
    family: string;
  }) => DebugIdentityRows;
  /**
   * Open a ZIP this radio's older tooling wrote, which is not a backup archive. Returns the reads
   * it holds, oldest first, or `undefined` when the bytes are not that format. Radio-home format.
   */
  openLegacyArchive?: (bytes: Uint8Array) => readonly DebugArchive[] | undefined;
  /**
   * Hex and Compare notes for one region of this radio's archive: a different representation line,
   * an address caveat, or a tag after the region label. Absent: none.
   */
  regionNote?: (archive: DebugArchive, regionId: string) => RadioDebugRegionNote;
  /** Caption under the identity grid, after the generic sentence. */
  identityNote?: string;
  /** Backup-tab notice about what the read sends and how to recover. */
  readNotice?: { title: string; text: string };
  /** Explains why Calibration is empty when this profile has no calibration view yet. */
  calibrationNote?: string;
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

const radioFoundry = (
  radio: string,
  model: string,
  archiveModelId: string,
): RadioDebugDescriptor => ({
  slug: `${radio}-radiofoundry`,
  radio,
  firmware: 'radiofoundry',
  model,
  archiveModelId,
  family: 'RadioFoundry',
  capture: captureRadioFoundry(archiveModelId),
  captureOptions: RADIOFOUNDRY_CAPTURE_OPTIONS,
  captureStages: RADIOFOUNDRY_CAPTURE_STAGES,
  sensitiveRanges: radioFoundryArchiveSensitiveRanges,
  identityRows: radioFoundryIdentityRows,
  identityNote: RADIOFOUNDRY_IDENTITY_NOTE,
  readNotice: RADIOFOUNDRY_READ_NOTICE,
  calibrationNote: RADIOFOUNDRY_CALIBRATION_NOTE,
  readHistory: true,
  coverage: radioFoundryCoverage,
  settings: radioFoundrySettingsView,
  compare: radioFoundryCompareAdapter,
  Memory: RadioFoundryMemory,
  capabilities: capabilities('Available', 'Not yet available', 'Partial'),
});

const unavailable = capabilities('Not yet available', 'Not yet available', 'Not yet available');

/** Badge colour for a capability status. */
export const capabilityColor = (status: RadioDebugCapabilityStatus) =>
  status === 'Available' ? 'green' : status === 'Partial' ? 'yellow' : 'gray';

export const radioDebugDescriptors: readonly RadioDebugDescriptor[] = [
  {
    slug: 'at-d890uv',
    radio: 'at-d890uv',
    firmware: 'stock',
    // Hooked here, not in atD890Compare.ts: the snapshot's imports reach back into this module.
    compare: { ...atD890CompareAdapter, decoded: atD890DecodedSnapshot },
    Memory: AtD890Memory,
    coverage: atD890Coverage,
    settings: atD890SettingsView,
    calibration: atD890CalibrationView,
    CompareExtra: AtD890Compare,
    readHistory: true,
    capture: captureAtD890,
    sensitiveRanges: atD890ArchiveSensitiveRanges,
    identityRows: atD890IdentityRows,
    identityNote: AT_D890_IDENTITY_NOTE,
    readNotice: AT_D890_READ_NOTICE,
    model: 'AT-D890UV',
    archiveModelId: 'AT-D890UV',
    family: 'AnyTone · stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'dm-32uv',
    radio: 'dm-32uv',
    firmware: 'stock',
    compare: dm32CompareAdapter,
    Memory: Dm32Memory,
    coverage: dm32Coverage,
    settings: dm32SettingsView,
    calibration: dm32CalibrationView,
    readHistory: true,
    capture: captureDm32,
    sensitiveRanges: dm32ArchiveSensitiveRanges,
    identityRows: dm32IdentityRows,
    identityNote: DM32_IDENTITY_NOTE,
    readNotice: DM32_READ_NOTICE,
    model: 'DM-32UV',
    archiveModelId: 'DM-32UV',
    family: 'Baofeng · stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  radioFoundry('dm-32uv', 'DM-32UV', 'DM-32UV-RadioFoundry'),
  {
    slug: 'dm-1701-opengd77',
    radio: 'dm-1701',
    firmware: 'opengd77',
    compare: openGd77CompareAdapter,
    calibration: openGd77CalibrationView,
    Memory: OpenGd77Memory,
    coverage: openGd77Coverage,
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
  radioFoundry('dm-1701', 'DM-1701', 'DM-1701-RadioFoundry'),
  {
    slug: 'md-9600-opengd77',
    radio: 'md-9600',
    firmware: 'opengd77',
    compare: openGd77CompareAdapter,
    calibration: openGd77CalibrationView,
    Memory: OpenGd77Memory,
    coverage: openGd77Coverage,
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
  radioFoundry('md-9600', 'MD-9600', 'MD-9600-RadioFoundry'),
  radioFoundry('rt84', 'RT84', 'RT84-RadioFoundry'),
  radioFoundry('rt90', 'RT90', 'RT90-RadioFoundry'),
  {
    slug: 'rt95',
    radio: 'rt95',
    firmware: 'stock',
    compare: rt95CompareAdapter,
    Memory: Rt95MemoryView,
    coverage: rt95Coverage,
    memoryNotDecoded: RT95_MEMORY_NOT_DECODED,
    settings: rt95SettingsView,
    calibration: rt95CalibrationView,
    readHistory: true,
    capture: captureRt95,
    sensitiveRanges: rt95ArchiveSensitiveRanges,
    captureStages: RT95_CAPTURE_STAGES,
    identityRows: rt95IdentityRows,
    regionNote: (_archive, regionId) => rt95RegionNote(regionId),
    model: 'RT95',
    archiveModelId: 'retevis-rt95',
    family: 'Stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'uv-21-pro-v2',
    radio: 'uv-21-pro-v2',
    firmware: 'stock',
    model: 'UV-21 Pro V2',
    archiveModelId: 'UV-21Pro V2',
    family: 'Stock family',
    capabilities: unavailable,
  },
  {
    slug: 'uv-5r-mini',
    radio: 'uv-5r-mini',
    firmware: 'stock',
    alsoGuards: ['/debug/uv5r-mini'],
    compare: uv5rMiniCompareAdapter,
    Memory: Uv5rMiniMemory,
    coverage: uv5rMiniCoverage,
    extraHexRegions: uv5rMiniExtraHexRegions,
    memoryNotDecoded: UV5R_MINI_MEMORY_NOT_DECODED,
    settings: uv5rMiniSettingsView,
    calibration: uv5rMiniCalibrationView,
    readHistory: true,
    capture: captureUv5rMini,
    identityRows: uv5rMiniIdentityRows,
    openLegacyArchive: openUv5rMiniLegacyArchive,
    regionNote: (_archive, regionId) => uv5rMiniRegionNote(regionId),
    model: 'UV-5R Mini',
    archiveModelId: 'UV-5R Mini',
    family: 'Stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
];

export function descriptorForPair(
  radio: string,
  firmware: string,
): RadioDebugDescriptor | undefined {
  if (!isDebugFirmwareFamily(firmware)) return undefined;
  return radioDebugDescriptors.find((d) => d.radio === radio && d.firmware === firmware);
}

/** Every descriptor of one radio, in DEBUG_FIRMWARE_ORDER. Empty for an unknown radio. */
export function firmwaresOf(radio: string): readonly RadioDebugDescriptor[] {
  const matches = radioDebugDescriptors.filter((d) => d.radio === radio);
  const order = new Map(DEBUG_FIRMWARE_ORDER.map((f, i) => [f, i]));
  return [...matches].sort((a, b) => order.get(a.firmware)! - order.get(b.firmware)!);
}

/** One entry per radio, in first-appearance order of the array. */
export function debugRadios(): readonly {
  radio: string;
  model: string;
  firmwares: readonly RadioDebugDescriptor[];
}[] {
  const seen = new Map<
    string,
    { radio: string; model: string; firmwares: RadioDebugDescriptor[] }
  >();
  for (const d of radioDebugDescriptors) {
    let entry = seen.get(d.radio);
    if (!entry) {
      entry = { radio: d.radio, model: d.model, firmwares: [] };
      seen.set(d.radio, entry);
    }
    entry.firmwares.push(d);
  }
  const order = new Map(DEBUG_FIRMWARE_ORDER.map((f, i) => [f, i]));
  return [...seen.values()].map((entry) => ({
    ...entry,
    firmwares: [...entry.firmwares].sort((a, b) => order.get(a.firmware)! - order.get(b.firmware)!),
  }));
}

/** An old pair slug (exact `slug` match wins) or a bare radio key (its first firmware). */
export function resolveLegacyDebugSlug(
  slugOrRadio: string,
): { radio: string; firmware: DebugFirmwareFamily } | undefined {
  const bySlug = radioDebugDescriptors.find((d) => d.slug === slugOrRadio);
  if (bySlug) return { radio: bySlug.radio, firmware: bySlug.firmware };
  const firmwares = firmwaresOf(slugOrRadio);
  if (!firmwares.length) return undefined;
  return { radio: firmwares[0]!.radio, firmware: firmwares[0]!.firmware };
}

export const debugRadioPath = (d: Pick<RadioDebugDescriptor, 'radio' | 'firmware'>) =>
  `/debug/radios/${d.radio}/${d.firmware}`;

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
