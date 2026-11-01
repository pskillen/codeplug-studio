import { useMemo, useState } from 'react';
import {
  egressSummary,
  groupRadioCatalog,
  type FirmwareRow,
  type RadioCatalogFilter,
} from '@core/radio-targets/index.ts';
import { SearchInput, SegmentedControl } from '../v2/index.ts';
import { FirmwareKindPill, RadioClassPill } from './RadioModelPills.tsx';
import classes from './RadioTargetPicker.module.css';

type ClassFilter = NonNullable<RadioCatalogFilter['radioClass']>;
type FirmwareFilter = NonNullable<RadioCatalogFilter['firmware']>;

const CLASS_OPTIONS: { value: ClassFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dmr', label: 'DMR' },
  { value: 'fm', label: 'FM only' },
];

const FIRMWARE_OPTIONS: { value: FirmwareFilter; label: string }[] = [
  { value: 'any', label: 'Any firmware' },
  { value: 'stock', label: 'Stock' },
  { value: 'modded', label: 'Mods & open' },
];

export interface RadioTargetPickerProps {
  /** Selected radio target id. */
  value: string | null;
  onChange: (radioTargetId: string) => void;
  /** Existing builds per radio target id — shows "N builds" on a firmware row. */
  buildCounts?: ReadonlyMap<string, number>;
}

function formFactorLabel(radioClass: string, formFactor: string): string {
  return `${radioClass === 'dmr' ? 'DMR' : 'FM'} · dual band ${formFactor}`;
}

function FirmwareOption({
  modelId,
  row,
  selected,
  count,
  onSelect,
}: {
  modelId: string;
  row: FirmwareRow;
  selected: boolean;
  count: number;
  onSelect: (id: string) => void;
}) {
  const { firmware, target, supported } = row;
  const rowClass = [classes.fw, selected ? classes.fwOn : '', supported ? '' : classes.fwDisabled]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={rowClass}>
      <input
        type="radio"
        name="radio-target"
        className={classes.radio}
        value={target?.id ?? `${modelId}:${firmware.id}`}
        checked={selected}
        disabled={!supported}
        onChange={() => target && onSelect(target.id)}
      />
      <span className={classes.fwLabel}>{firmware.label}</span>
      {firmware.kind !== 'stock' ? <FirmwareKindPill kind={firmware.kind} /> : null}
      {!supported ? <span className={classes.notSupported}>Not supported</span> : null}
      {target ? <span className={classes.paths}>{egressSummary(target)}</span> : null}
      {count > 0 ? (
        <span className={classes.have}>
          {count} {count === 1 ? 'build' : 'builds'}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Radio catalog picker: manufacturer sections, one card per model, firmware variants as
 * radio rows. Owns search + filter state; selection is controlled.
 */
export default function RadioTargetPicker({
  value,
  onChange,
  buildCounts,
}: RadioTargetPickerProps) {
  const [query, setQuery] = useState('');
  const [radioClass, setRadioClass] = useState<ClassFilter>('all');
  const [firmware, setFirmware] = useState<FirmwareFilter>('any');

  const groups = useMemo(
    () => groupRadioCatalog({ query, radioClass, firmware }),
    [query, radioClass, firmware],
  );

  return (
    <div className={classes.root}>
      <div className={classes.filters}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search radios…"
          aria-label="Search radios"
          className={classes.search}
        />
        <SegmentedControl
          size="md"
          aria-label="Radio class"
          value={radioClass}
          onChange={setRadioClass}
          options={CLASS_OPTIONS}
        />
        <SegmentedControl
          size="md"
          aria-label="Firmware kind"
          value={firmware}
          onChange={setFirmware}
          options={FIRMWARE_OPTIONS}
        />
      </div>

      {groups.length === 0 ? <p className={classes.empty}>No radios match these filters.</p> : null}

      {groups.map((group) => (
        <section key={group.manufacturer} className={classes.mfr}>
          <h2 className={classes.mfrHead}>
            <span className={classes.mfrName}>{group.manufacturer}</span>
            <span className={classes.muted}>
              {group.models.length} {group.models.length === 1 ? 'radio' : 'radios'}
            </span>
          </h2>
          <div className={classes.grid}>
            {group.models.map(({ model, firmware: rows }) => (
              <div
                key={model.id}
                className={[
                  classes.card,
                  rows.some((r) => r.target?.id === value) ? classes.cardOn : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={classes.cardTop}>
                  <div>
                    <div className={classes.modelName}>{model.label}</div>
                    <div className={classes.modelType}>
                      {formFactorLabel(model.radioClass, model.formFactor)}
                    </div>
                  </div>
                  <RadioClassPill radioClass={model.radioClass} />
                </div>
                <div
                  className={classes.fwList}
                  role="radiogroup"
                  aria-label={`${model.manufacturer} ${model.label} firmware`}
                >
                  {rows.map((row) => (
                    <FirmwareOption
                      key={row.firmware.id}
                      modelId={model.id}
                      row={row}
                      selected={row.target != null && row.target.id === value}
                      count={row.target ? (buildCounts?.get(row.target.id) ?? 0) : 0}
                      onSelect={onChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
