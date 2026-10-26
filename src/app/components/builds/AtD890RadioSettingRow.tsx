/**
 * One AT-D890UV radio setting: label, where it lives on the radio, help, the value the radio holds,
 * and a Keep / Set control (#1393). Renders from core field metadata only.
 */

import { memo } from 'react';
import { NativeSelect } from '@mantine/core';
import {
  atD890SettingExposureFor,
  atD890SettingOptionsFor,
  atD890TextProblem,
  type AtD890SettingExposure,
  type AtD890SettingFieldDef,
  type AtD890SettingsTargetId,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type {
  AtD890DecodedSetting,
  AtD890SettingValue,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { Button, TextInput } from '../v2/index.ts';
import {
  KEEP_RADIO_VALUE_LABEL,
  SET_EMPTY_LINE_HINT,
  SET_EMPTY_LINE_LABEL,
  radioValueText,
} from '../../lib/atD890RadioSettingsText.ts';
import classes from './AtD890RadioSettingRow.module.css';

const EXPOSURE_TAG: Record<AtD890SettingExposure, string> = {
  menu: 'On radio menu',
  cps: 'CPS only',
  hidden: 'Hidden',
};

const KEEP = 'keep';

export interface AtD890RadioSettingRowProps {
  field: AtD890SettingFieldDef;
  target: AtD890SettingsTargetId;
  /** The session override, when the user chose to set this field. */
  override: AtD890SettingValue | undefined;
  /** What the last Read found; `undefined` before any Read. */
  decoded: AtD890DecodedSetting | undefined;
  /** True once a radio has been read (so a missing `decoded` means "not on this radio"). */
  hasRead: boolean;
  onSet: (value: AtD890SettingValue) => void;
  onClear: () => void;
  /** Extra line under the control, e.g. the large-font hint. */
  note?: string;
  /** The control is disabled, and why (e.g. Language before a read). */
  disabledReason?: string;
  /** An amber line under the control: the set value may not do what the user expects. */
  caution?: string;
  /** A red line under the control: the set value cannot be written to the read radio. */
  problem?: string;
}

function AtD890RadioSettingRowView({
  field,
  target,
  override,
  decoded,
  hasRead,
  onSet,
  onClear,
  note,
  disabledReason,
  caution,
  problem,
}: AtD890RadioSettingRowProps) {
  const isSet = override !== undefined;
  const exposure = atD890SettingExposureFor(field, target);
  const radioText = radioValueText(field, target, decoded, hasRead);
  const controlId = `d890-setting-${field.id}`;

  let control;
  if (field.kind === 'text') {
    const text = typeof override === 'string' ? override : '';
    const problem = isSet ? atD890TextProblem(field, text) : undefined;
    const setEmpty = isSet && text === '';
    control = (
      <TextInput
        id={controlId}
        aria-label={field.label}
        value={text}
        placeholder={setEmpty ? SET_EMPTY_LINE_LABEL : KEEP_RADIO_VALUE_LABEL}
        error={Boolean(problem)}
        hint={problem ?? (setEmpty ? SET_EMPTY_LINE_HINT : undefined)}
        onChange={(e) => onSet(e.target.value)}
      />
    );
  } else {
    const options =
      field.kind === 'boolean'
        ? [
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]
        : atD890SettingOptionsFor(field, target).map((o) => ({
            value: String(o.value),
            label: o.label,
          }));
    const current =
      override === undefined
        ? KEEP
        : typeof override === 'boolean'
          ? override
            ? 'on'
            : 'off'
          : String(override);
    control = (
      <NativeSelect
        id={controlId}
        aria-label={field.label}
        value={current}
        disabled={disabledReason !== undefined}
        data={[{ value: KEEP, label: KEEP_RADIO_VALUE_LABEL }, ...options]}
        onChange={(e) => {
          const next = e.currentTarget.value;
          if (next === KEEP) onClear();
          else if (field.kind === 'boolean') onSet(next === 'on');
          else onSet(Number(next));
        }}
      />
    );
  }

  return (
    <div className={classes.row} data-field-id={field.id} data-set={isSet ? 'true' : 'false'}>
      <div className={classes.info}>
        <div className={classes.labelLine}>
          <label className={classes.label} htmlFor={controlId}>
            {field.label}
          </label>
          <span className={classes.tag}>{EXPOSURE_TAG[exposure]}</span>
        </div>
        <div className={classes.help}>{field.help}</div>
      </div>
      <div className={classes.radio}>
        <span className={classes.radioCaption}>Radio:</span> <span>{radioText}</span>
      </div>
      <div className={classes.controlCell}>
        <div className={classes.control}>{control}</div>
        <div className={classes.marker}>
          {isSet ? (
            <>
              <span className={classes.dot} role="img" aria-label="Will be set" />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Clear ${field.label}`}
                onClick={onClear}
              >
                Clear
              </Button>
            </>
          ) : null}
        </div>
        {disabledReason ? <div className={classes.note}>{disabledReason}</div> : null}
        {note ? <div className={classes.note}>{note}</div> : null}
        {caution ? (
          <div className={classes.warning} data-testid="field-caution">
            {caution}
          </div>
        ) : null}
        {problem ? (
          <div className={classes.problem} role="alert">
            {problem}
          </div>
        ) : null}
        {isSet && field.warning ? (
          <div className={classes.warning} data-testid="field-warning">
            {field.warning}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The page holds about a hundred rows and re-renders on every store change, so a row re-renders
 * only when something it shows changed. `onSet` and `onClear` are ignored on purpose: callers
 * build them from the build id and field id alone, so a new closure never means new behaviour.
 */
const AtD890RadioSettingRow = memo(AtD890RadioSettingRowView, (a, b) => {
  const sameField =
    a.field === b.field ||
    (a.field.id === b.field.id && JSON.stringify(a.field) === JSON.stringify(b.field));
  return (
    sameField &&
    a.target === b.target &&
    a.override === b.override &&
    a.decoded === b.decoded &&
    a.hasRead === b.hasRead &&
    a.note === b.note &&
    a.disabledReason === b.disabledReason &&
    a.caution === b.caution &&
    a.problem === b.problem
  );
});

export default AtD890RadioSettingRow;
