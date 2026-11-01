/**
 * Radio x feature support matrix (#1494). Pure projection of the radio catalog: nothing here is a hand-kept
 * tick table. Every cell comes from `RADIO_MODELS` (class, firmware), `RADIO_TARGETS` (traits, egress) and the
 * firmware flasher's radio list. Deploy-specific facts (is Write hidden on this site, is the flasher offered)
 * are injected via {@link SupportMatrixAvailability} so core never reads the integrations layer.
 */
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import { firmwareRadioIdForModel, type FirmwareRadioId } from '@core/firmware/index.ts';
import type { CompatibleEgress, RadioTarget } from './catalog.ts';
import { radioTargetForModelFirmware } from './grouping.ts';
import { listRadioModels, type FirmwareVariant, type RadioModel } from './models.ts';

export type SupportState = 'supported' | 'partial' | 'unsupported' | 'na';

export type SupportGroupId = 'program' | 'organise' | 'dmr' | 'firmware';

export type SupportColumnId =
  | 'writeCable'
  | 'readBack'
  | 'cpsFile'
  | 'zones'
  | 'scanLists'
  | 'zoneIsScan'
  | 'talkGroups'
  | 'multiTalkGroup'
  | 'flash';

export interface SupportColumn {
  id: SupportColumnId;
  group: SupportGroupId;
  label: string;
  /** One-line plain-language meaning, used as a tooltip / finder hint. */
  hint: string;
}

export const SUPPORT_GROUPS: readonly { id: SupportGroupId; label: string }[] = [
  { id: 'program', label: 'Program it' },
  { id: 'organise', label: 'Organise' },
  { id: 'dmr', label: 'DMR' },
  { id: 'firmware', label: 'Firmware' },
];

export const SUPPORT_COLUMNS: readonly SupportColumn[] = [
  {
    id: 'writeCable',
    group: 'program',
    label: 'Write via cable',
    hint: 'Send the codeplug straight to the radio from the browser (Web Serial).',
  },
  {
    id: 'readBack',
    group: 'program',
    label: 'Read back',
    hint: 'Read the radio into Studio over the cable.',
  },
  {
    id: 'cpsFile',
    group: 'program',
    label: 'CPS file',
    hint: 'Export a file for the maker’s or a community programming tool.',
  },
  { id: 'zones', group: 'organise', label: 'Zones', hint: 'Group channels into zones.' },
  {
    id: 'scanLists',
    group: 'organise',
    label: 'Scan lists',
    hint: 'Dedicated scan lists. Partial when scanning is a per-channel flag or follows the zone.',
  },
  {
    id: 'zoneIsScan',
    group: 'organise',
    label: 'Zone = scan',
    hint: 'A zone is also the scan list, so one list does both jobs.',
  },
  { id: 'talkGroups', group: 'dmr', label: 'Talk groups', hint: 'DMR talk groups and contacts.' },
  {
    id: 'multiTalkGroup',
    group: 'dmr',
    label: 'Multi-TG channel',
    hint: 'One channel carries several talk groups.',
  },
  { id: 'flash', group: 'firmware', label: 'Flash', hint: 'Install this firmware from Studio.' },
];

export type SupportCells = Record<SupportColumnId, SupportState>;

export interface SupportFirmwareRow {
  firmware: FirmwareVariant;
  /** Radio target id, or undefined when Studio has no target for this model + firmware. */
  targetId: string | undefined;
  /** False for firmware Studio cannot build for (for example stock DM-1701). */
  supported: boolean;
  cells: SupportCells;
  /** `supported` cells count 1, `partial` 0.5. Used to rank firmware for a model. */
  score: number;
}

export interface SupportModelRow {
  model: RadioModel;
  firmware: SupportFirmwareRow[];
  /** Firmware id with the highest score, ties to the earlier firmware. Undefined when nothing is supported. */
  bestFirmwareId: string | undefined;
}

/** Deploy-specific facts the catalog cannot know. Omitted hooks default to "available". */
export interface SupportMatrixAvailability {
  /** Cable (Web Serial) Write offered for this egress on this site. */
  cableWrite?: (egress: CompatibleEgress) => boolean;
  /** Cable (Web Serial) Read offered for this egress. */
  cableRead?: (egress: CompatibleEgress) => boolean;
  /** The flasher for this radio is offered on this site and platform. */
  firmwareFlash?: (radioId: FirmwareRadioId) => boolean;
}

export interface SupportMatrixInput {
  models?: readonly RadioModel[];
  /** Override target lookup (tests). */
  targetFor?: (modelId: string, firmwareId: string) => RadioTarget | undefined;
  availability?: SupportMatrixAvailability;
}

const ALL_UNSUPPORTED: SupportCells = {
  writeCable: 'unsupported',
  readBack: 'unsupported',
  cpsFile: 'unsupported',
  zones: 'unsupported',
  scanLists: 'unsupported',
  zoneIsScan: 'unsupported',
  talkGroups: 'unsupported',
  multiTalkGroup: 'unsupported',
  flash: 'unsupported',
};

function has(target: RadioTarget, trait: BuildCapabilityTrait): boolean {
  return target.traits.includes(trait);
}

function yes(value: boolean): SupportState {
  return value ? 'supported' : 'unsupported';
}

function scanListState(target: RadioTarget): SupportState {
  if (
    has(target, BuildCapabilityTrait.ScanLists) ||
    has(target, BuildCapabilityTrait.DedicatedScanLists)
  ) {
    return 'supported';
  }
  if (
    has(target, BuildCapabilityTrait.ZoneAsScanList) ||
    has(target, BuildCapabilityTrait.PerChannelScanFlag)
  ) {
    return 'partial';
  }
  return 'unsupported';
}

function cellsFor(
  model: RadioModel,
  firmware: FirmwareVariant,
  target: RadioTarget | undefined,
  availability: SupportMatrixAvailability,
): SupportCells {
  const cells: SupportCells = { ...ALL_UNSUPPORTED };
  if (target) {
    const serial = target.compatibleEgress.filter((e) => e.kind === 'web-serial');
    cells.writeCable = yes(serial.some((e) => availability.cableWrite?.(e) ?? true));
    cells.readBack = yes(serial.some((e) => availability.cableRead?.(e) ?? true));
    cells.cpsFile = yes(target.compatibleEgress.some((e) => e.kind === 'cps-file'));
    cells.zones = yes(has(target, BuildCapabilityTrait.ZoneGrouping));
    cells.scanLists = scanListState(target);
    cells.zoneIsScan = yes(has(target, BuildCapabilityTrait.ZoneAsScanList));
    cells.talkGroups = 'supported';
    cells.multiTalkGroup = yes(has(target, BuildCapabilityTrait.MultiTalkGroupPerChannel));
    // Stock is what the radio ships with: nothing to flash. The flasher installs the MM9PDY mod, so only
    // `mod` firmware on a model with a flasher counts, and only where this site offers it.
    if (firmware.kind === 'stock') cells.flash = 'na';
    else {
      const radioId = firmware.kind === 'mod' ? firmwareRadioIdForModel(model.id) : undefined;
      cells.flash = yes(radioId != null && (availability.firmwareFlash?.(radioId) ?? true));
    }
  }
  // DMR-only columns do not exist on an analogue radio.
  if (model.radioClass === 'fm') {
    cells.talkGroups = 'na';
    cells.multiTalkGroup = 'na';
  }
  return cells;
}

function scoreOf(cells: SupportCells): number {
  return Object.values(cells).reduce(
    (sum, state) => sum + (state === 'supported' ? 1 : state === 'partial' ? 0.5 : 0),
    0,
  );
}

/** Build the whole matrix: a row per model, a sub-row per firmware variant (stock always listed). */
export function buildSupportMatrix(input: SupportMatrixInput = {}): SupportModelRow[] {
  const availability = input.availability ?? {};
  const targetFor = input.targetFor ?? radioTargetForModelFirmware;
  return (input.models ?? listRadioModels()).map((model) => {
    const firmware = model.firmware.map((fw): SupportFirmwareRow => {
      const target = targetFor(model.id, fw.id);
      const cells = cellsFor(model, fw, target, availability);
      return {
        firmware: fw,
        targetId: target?.id,
        supported: target != null,
        cells,
        score: scoreOf(cells),
      };
    });
    let best: SupportFirmwareRow | undefined;
    for (const row of firmware) {
      if (row.supported && (!best || row.score > best.score)) best = row;
    }
    return { model, firmware, bestFirmwareId: best?.firmware.id };
  });
}

/** Models matching a class filter (`all` keeps every model). */
export function filterSupportMatrix(
  rows: readonly SupportModelRow[],
  radioClass: 'all' | 'dmr' | 'fm',
): SupportModelRow[] {
  return radioClass === 'all' ? [...rows] : rows.filter((r) => r.model.radioClass === radioClass);
}
