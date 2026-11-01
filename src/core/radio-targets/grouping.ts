import { listRadioTargets, radioTargetFor, type RadioTarget } from './catalog.ts';
import {
  firmwareVariantFor,
  listRadioModels,
  radioModelDisplayLabel,
  radioModelFor,
  type FirmwareKind,
  type FirmwareVariant,
  type RadioClass,
  type RadioModel,
} from './models.ts';

/** Manufacturer shown for a target id / model that is not in the catalog. */
export const UNKNOWN_MANUFACTURER = 'Other';

function byLabel(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

// ---------------------------------------------------------------------------
// Per-target lookups
// ---------------------------------------------------------------------------

export function radioModelForTarget(target: RadioTarget): RadioModel | undefined {
  return radioModelFor(target.modelId);
}

export function firmwareForTarget(target: RadioTarget): FirmwareVariant | undefined {
  return firmwareVariantFor(target.modelId, target.firmwareId);
}

/** Manufacturer for a catalog target id; {@link UNKNOWN_MANUFACTURER} when unknown. */
export function manufacturerForRadioTarget(radioTargetId: string): string {
  const target = radioTargetFor(radioTargetId);
  return (target && radioModelForTarget(target)?.manufacturer) ?? UNKNOWN_MANUFACTURER;
}

/**
 * Full display label: "Baofeng DM-32UV · MM9PDY". Stock is the default firmware, so it
 * carries no suffix ("Baofeng DM-32UV"). Unknown ids fall back to the id itself.
 */
export function radioTargetDisplayLabel(radioTargetId: string): string {
  const target = radioTargetFor(radioTargetId);
  const model = target && radioModelForTarget(target);
  if (!target || !model) return radioTargetId;
  const firmware = firmwareForTarget(target);
  const base = radioModelDisplayLabel(model);
  return firmware && firmware.kind !== 'stock' ? `${base} · ${firmware.label}` : base;
}

/** The target for a model's firmware variant, if Codeplug Studio can export for it. */
export function radioTargetForModelFirmware(
  modelId: string,
  firmwareId: string,
): RadioTarget | undefined {
  return listRadioTargets().find((t) => t.modelId === modelId && t.firmwareId === firmwareId);
}

/** Short export-route summary, e.g. "Web Serial · NeonPlug · DM32 CSV". */
export function egressSummary(target: RadioTarget): string {
  return target.compatibleEgress.map((entry) => entry.label).join(' · ');
}

// ---------------------------------------------------------------------------
// Catalog grouping (New build picker, landing-page matrix)
// ---------------------------------------------------------------------------

export interface FirmwareRow {
  firmware: FirmwareVariant;
  /** `undefined` when the model lists this firmware but there is no export target yet. */
  target: RadioTarget | undefined;
  supported: boolean;
}

export interface ModelGroup {
  model: RadioModel;
  /** Firmware in the model's declared order. */
  firmware: FirmwareRow[];
}

export interface ManufacturerGroup {
  manufacturer: string;
  models: ModelGroup[];
}

export interface RadioCatalogFilter {
  /** Case-insensitive substring over manufacturer, model, firmware label and form factor. */
  query?: string;
  radioClass?: RadioClass | 'all';
  /** `stock` = factory firmware only; `modded` = mods and open firmware; `any` = no filter. */
  firmware?: 'any' | 'stock' | 'modded';
}

function firmwareMatches(kind: FirmwareKind, filter: RadioCatalogFilter['firmware']): boolean {
  if (!filter || filter === 'any') return true;
  return filter === 'stock' ? kind === 'stock' : kind !== 'stock';
}

/**
 * Group every model → firmware under its manufacturer. Stock is always listed for each
 * model, flagged `supported: false` when no target exists. Manufacturers and models are
 * alphabetical; firmware keeps its declared order. Groups left empty by a filter are
 * dropped.
 */
export function groupRadioCatalog(filter: RadioCatalogFilter = {}): ManufacturerGroup[] {
  const query = filter.query?.trim().toLowerCase() ?? '';
  const byManufacturer = new Map<string, ModelGroup[]>();

  for (const model of listRadioModels()) {
    if (
      filter.radioClass &&
      filter.radioClass !== 'all' &&
      model.radioClass !== filter.radioClass
    ) {
      continue;
    }

    const modelText = `${model.manufacturer} ${model.label} ${model.formFactor}`.toLowerCase();
    const modelHit = query === '' || modelText.includes(query);

    const rows: FirmwareRow[] = [];
    for (const firmware of model.firmware) {
      if (!firmwareMatches(firmware.kind, filter.firmware)) continue;
      if (!modelHit && !firmware.label.toLowerCase().includes(query)) continue;
      const target = radioTargetForModelFirmware(model.id, firmware.id);
      rows.push({ firmware, target, supported: target != null });
    }
    if (rows.length === 0) continue;

    const list = byManufacturer.get(model.manufacturer) ?? [];
    list.push({ model, firmware: rows });
    byManufacturer.set(model.manufacturer, list);
  }

  return [...byManufacturer.entries()]
    .sort(([a], [b]) => byLabel(a, b))
    .map(([manufacturer, models]) => ({
      manufacturer,
      models: models.sort((a, b) => byLabel(a.model.label, b.model.label)),
    }));
}

// ---------------------------------------------------------------------------
// Build grouping (Export for radio list, switchers)
// ---------------------------------------------------------------------------

/** Minimum shape needed to group a build. */
export interface GroupableBuild {
  radioTargetId: string;
  name: string;
}

export interface BuildFirmwareGroup<T extends GroupableBuild> {
  key: string;
  firmware: FirmwareVariant;
  /** Catalog target, `undefined` for unknown ids. */
  target: RadioTarget | undefined;
  builds: T[];
}

export interface BuildModelGroup<T extends GroupableBuild> {
  key: string;
  /** Catalog model; `undefined` for builds whose target is not in the catalog. */
  model: RadioModel | undefined;
  /** Model label, or the raw target id for unknown targets. */
  label: string;
  firmware: BuildFirmwareGroup<T>[];
  buildCount: number;
}

export interface BuildManufacturerGroup<T extends GroupableBuild> {
  key: string;
  manufacturer: string;
  models: BuildModelGroup<T>[];
  buildCount: number;
}

/**
 * Group builds manufacturer → model → firmware. Derived from each build's
 * `radioTargetId`, so no persistence change is needed. Only combinations that have
 * builds appear. Ordering: manufacturer and model alphabetical, firmware in catalog
 * order, builds by name. Builds with an unknown target land under "Other".
 */
export function groupBuildsByRadio<T extends GroupableBuild>(
  builds: readonly T[],
): BuildManufacturerGroup<T>[] {
  const manufacturers = new Map<string, Map<string, BuildModelGroup<T>>>();

  for (const build of builds) {
    const target = radioTargetFor(build.radioTargetId);
    const model = target ? radioModelForTarget(target) : undefined;
    const firmware: FirmwareVariant = (target && firmwareForTarget(target)) ?? {
      id: build.radioTargetId,
      label: 'Unknown',
      kind: 'stock',
    };
    const manufacturer = model?.manufacturer ?? UNKNOWN_MANUFACTURER;
    const modelKey = model?.id ?? `unknown:${build.radioTargetId}`;

    const models = manufacturers.get(manufacturer) ?? new Map<string, BuildModelGroup<T>>();
    manufacturers.set(manufacturer, models);
    let modelGroup = models.get(modelKey);
    if (!modelGroup) {
      modelGroup = {
        key: `${manufacturer}/${modelKey}`,
        model,
        label: model?.label ?? build.radioTargetId,
        firmware: [],
        buildCount: 0,
      };
      models.set(modelKey, modelGroup);
    }
    let fwGroup = modelGroup.firmware.find((g) => g.firmware.id === firmware.id);
    if (!fwGroup) {
      fwGroup = { key: `${modelGroup.key}/${firmware.id}`, firmware, target, builds: [] };
      modelGroup.firmware.push(fwGroup);
    }
    fwGroup.builds.push(build);
    modelGroup.buildCount += 1;
  }

  return [...manufacturers.entries()]
    .sort(([a], [b]) => byLabel(a, b))
    .map(([manufacturer, models]) => {
      const modelGroups = [...models.values()].sort((a, b) => byLabel(a.label, b.label));
      for (const modelGroup of modelGroups) {
        const order = modelGroup.model?.firmware.map((fw) => fw.id) ?? [];
        modelGroup.firmware.sort(
          (a, b) => order.indexOf(a.firmware.id) - order.indexOf(b.firmware.id),
        );
        for (const fwGroup of modelGroup.firmware) {
          fwGroup.builds.sort((a, b) => byLabel(a.name, b.name));
        }
      }
      return {
        key: manufacturer,
        manufacturer,
        models: modelGroups,
        buildCount: modelGroups.reduce((sum, m) => sum + m.buildCount, 0),
      };
    });
}

/** Count builds per radio target id — "N builds" hints in the New build picker. */
export function countBuildsByTarget(builds: readonly GroupableBuild[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const build of builds) {
    counts.set(build.radioTargetId, (counts.get(build.radioTargetId) ?? 0) + 1);
  }
  return counts;
}
