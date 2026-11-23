/**
 * Radio x feature support matrix (#1494). Pure projection of the radio catalog: nothing here is a hand-kept
 * tick table. Every cell comes from `RADIO_MODELS` (class, firmware), `RADIO_TARGETS` (traits, egress) and the
 * firmware flasher's radio list. Deploy-specific facts (is Write hidden on this site, is the flasher offered)
 * are injected via {@link SupportMatrixAvailability} so core never reads the integrations layer.
 */
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import { firmwareRadioIdForModel, type FirmwareRadioId } from '@core/firmware/index.ts';
import type { CompatibleEgress, RadioTarget } from './catalog.ts';
import { radioTargetForModelFirmware } from './grouping.ts';
import { listRadioModels, type FirmwareVariant, type RadioModel } from './models.ts';
import {
  RADIO_RF_CAPABILITIES,
  getRadioRfCapabilities,
  type RadioRfCapabilities,
} from './rfCapabilities.ts';
import { SUPPORT_FACTS, type SupportFacts } from './supportEvidence.ts';

export type SupportState = 'supported' | 'partial' | 'unsupported' | 'na';

export type SupportGroupId = 'program' | 'organise' | 'dmr' | 'firmware';

export type SupportColumnId =
  | 'writeCable'
  | 'readBack'
  | 'cpsFile'
  | 'satelliteKeps'
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
  {
    id: 'satelliteKeps',
    group: 'program',
    label: 'Satellite keps',
    hint: 'Write satellite orbital data (keps) to the radio over the cable.',
  },
  { id: 'zones', group: 'organise', label: 'Zones', hint: 'Group channels into zones.' },
  {
    id: 'scanLists',
    group: 'organise',
    label: 'Scan lists',
    hint: 'Scan lists, either dedicated or with the zone as the scan. Partial when scanning is only a per-channel flag.',
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

/** Evidence that a mode works on a radio + firmware, from the firmware project's own records. */
export type SupportEvidence = 'on-air' | 'bench' | 'unverified';

/** Studio's ways of getting a codeplug onto the radio. */
export type SupportPath = 'cable' | 'file';

/** Display order of channel-mode columns. A column exists only when some target supports the mode. */
export const SUPPORT_MODE_ORDER: readonly ChannelMode[] = [
  'fm',
  'am',
  'ssb',
  'dmr',
  'dstar',
  'ysf',
  'p25',
  'nxdn',
  'm17',
  'tetra',
];

export interface SupportModeCell {
  state: SupportState;
  /** Paths that carry this mode: `cable` when the writeCable cell is supported, `file` when cpsFile is. Empty unless supported. */
  paths: readonly SupportPath[];
  /** Recorded evidence; undefined when nothing is recorded. */
  evidence?: SupportEvidence;
  /** One sentence: where the evidence comes from. */
  evidenceSource?: string;
  /** One sentence: a condition (shown with a dagger), e.g. "only when the radio's build has it on". */
  note?: string;
}

/** The firmware build Studio was checked against, for firmware that has one. */
export interface SupportFirmwareBuild {
  /** Short, e.g. "RadioFoundry 454a5b76 (2026-11-22)". */
  label: string;
  /** One sentence for a tooltip. */
  note: string;
}

/** Mode columns in display order: every mode some capability row lists. */
export function listSupportModeColumns(
  capabilities: readonly Pick<RadioRfCapabilities, 'supportedModes'>[] = Object.values(
    RADIO_RF_CAPABILITIES,
  ),
): ChannelMode[] {
  const used = new Set(capabilities.flatMap((row) => row.supportedModes));
  return SUPPORT_MODE_ORDER.filter((mode) => used.has(mode));
}

export interface SupportFirmwareRow {
  firmware: FirmwareVariant;
  /** Radio target id, or undefined when Studio has no target for this model + firmware. */
  targetId: string | undefined;
  /** False for firmware Studio cannot build for (for example stock DM-1701). */
  supported: boolean;
  cells: SupportCells;
  /** One cell per `listSupportModeColumns()` mode. */
  modes: Partial<Record<ChannelMode, SupportModeCell>>;
  /** Conditions on feature cells (rendered with a dagger). Empty object when none. */
  notes: Partial<Record<SupportColumnId, string>>;
  build?: SupportFirmwareBuild;
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
  /** A satellite keps write is offered for this egress on this site. Omitted = not offered (core cannot know). */
  satelliteKeps?: (egress: CompatibleEgress) => boolean;
}

export interface SupportMatrixInput {
  models?: readonly RadioModel[];
  /** Override target lookup (tests). */
  targetFor?: (modelId: string, firmwareId: string) => RadioTarget | undefined;
  availability?: SupportMatrixAvailability;
  /** Override the RF capability lookup (tests). */
  rfFor?: (targetId: string) => RadioRfCapabilities | undefined;
  /** Override the evidence facts (tests). */
  facts?: SupportFacts;
}

const ALL_UNSUPPORTED: SupportCells = {
  writeCable: 'unsupported',
  readBack: 'unsupported',
  cpsFile: 'unsupported',
  satelliteKeps: 'unsupported',
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
  // Zone-as-scan is a different organisation, not a lesser one: both count as full support.
  if (
    has(target, BuildCapabilityTrait.ScanLists) ||
    has(target, BuildCapabilityTrait.DedicatedScanLists) ||
    has(target, BuildCapabilityTrait.ZoneAsScanList)
  ) {
    return 'supported';
  }
  if (has(target, BuildCapabilityTrait.PerChannelScanFlag)) {
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
    cells.satelliteKeps = yes(serial.some((e) => availability.satelliteKeps?.(e) ?? false));
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

function modeCellsFor(
  model: RadioModel,
  target: RadioTarget | undefined,
  cells: SupportCells,
  rf: (targetId: string) => RadioRfCapabilities | undefined,
  facts: SupportFacts,
  modeColumns: readonly ChannelMode[],
): Partial<Record<ChannelMode, SupportModeCell>> {
  const modes: Partial<Record<ChannelMode, SupportModeCell>> = {};
  for (const mode of modeColumns) {
    if (!target) {
      modes[mode] = { state: 'unsupported', paths: [] };
      continue;
    }
    if (model.radioClass === 'fm' && mode !== 'fm' && mode !== 'am' && mode !== 'ssb') {
      modes[mode] = { state: 'na', paths: [] };
      continue;
    }
    const rfRow = rf(target.id);
    const modeSupported = rfRow?.supportedModes.includes(mode) ?? false;
    const state: SupportState = modeSupported ? 'supported' : 'unsupported';
    let paths: readonly SupportPath[] = [];
    const fact = facts.modes[target.id]?.[mode];
    if (modeSupported) {
      const derived: SupportPath[] = [];
      if (cells.writeCable === 'supported') derived.push('cable');
      if (cells.cpsFile === 'supported') derived.push('file');
      paths = fact?.paths ? fact.paths.filter((p) => derived.includes(p)) : derived;
    }
    const cell: SupportModeCell = { state, paths };
    if (modeSupported && fact) {
      if (fact.evidence != null) cell.evidence = fact.evidence;
      if (fact.evidenceSource != null) cell.evidenceSource = fact.evidenceSource;
      if (fact.note != null) cell.note = fact.note;
    }
    modes[mode] = cell;
  }
  return modes;
}

function featureNotesFor(
  target: RadioTarget | undefined,
  firmware: FirmwareVariant,
  cells: SupportCells,
  facts: SupportFacts,
): Partial<Record<SupportColumnId, string>> {
  if (!target) return {};
  const raw = facts.featureNotes[firmware.id];
  if (!raw) return {};
  const notes: Partial<Record<SupportColumnId, string>> = {};
  for (const col of SUPPORT_COLUMNS) {
    const note = raw[col.id];
    if (note != null && cells[col.id] === 'supported') notes[col.id] = note;
  }
  return notes;
}

/** Build the whole matrix: a row per model, a sub-row per firmware variant (stock always listed). */
export function buildSupportMatrix(input: SupportMatrixInput = {}): SupportModelRow[] {
  const availability = input.availability ?? {};
  const targetFor = input.targetFor ?? radioTargetForModelFirmware;
  const rf = input.rfFor ?? getRadioRfCapabilities;
  const facts = input.facts ?? SUPPORT_FACTS;
  const modeColumns = listSupportModeColumns(Object.values(RADIO_RF_CAPABILITIES));
  return (input.models ?? listRadioModels()).map((model) => {
    const firmware = model.firmware.map((fw): SupportFirmwareRow => {
      const target = targetFor(model.id, fw.id);
      const cells = cellsFor(model, fw, target, availability);
      return {
        firmware: fw,
        targetId: target?.id,
        supported: target != null,
        cells,
        modes: modeCellsFor(model, target, cells, rf, facts, modeColumns),
        notes: featureNotesFor(target, fw, cells, facts),
        build: target ? facts.firmwareBuilds[fw.id] : undefined,
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
