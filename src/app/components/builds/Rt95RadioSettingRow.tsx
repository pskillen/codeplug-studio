/**
 * One RT95 radio setting: label, help, the value the radio holds, and a Keep / Set control (#1476).
 */

import { memo } from 'react';
import { NativeSelect } from '@mantine/core';
import {
  rt95FieldValueProblem,
  type Rt95SettingFieldDef,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import type { Rt95DecodedSetting } from '@integrations/radio-io/radios/rt95/settingsCodec.ts';
import type { Rt95SettingValue } from '@integrations/radio-io/radios/rt95/settingsFields.ts';
import { Button, TextInput } from '../v2/index.ts';
import {
  KEEP_RADIO_VALUE_LABEL,
  SET_EMPTY_LINE_HINT,
  SET_EMPTY_LINE_LABEL,
  radioValueText,
} from '../../lib/rt95RadioSettingsText.ts';
import classes from './AtD890RadioSettingRow.module.css';

const KEEP = 'keep';

export interface Rt95RadioSettingRowProps {
  field: Rt95SettingFieldDef;
  override: Rt95SettingValue | undefined;
  decoded: Rt95DecodedSetting | undefined;
  hasRead: boolean;
  onSet: (value: Rt95SettingValue) => void;
  onClear: () => void;
  note?: string;
  problem?: string;
}

function Rt95RadioSettingRowView({
  field,
  override,
  decoded,
  hasRead,
  onSet,
  onClear,
  note,
  problem: problemProp,
}: Rt95RadioSettingRowProps) {
  const isSet = override !== undefined;
  const radioText = radioValueText(field, decoded, hasRead);
  const controlId = `rt95-setting-${field.id}`;
  const isTextLike = field.kind === 'text' || field.kind === 'dtmfCode';

  let control;
  if (isTextLike) {
    const text = typeof override === 'string' ? override : '';
    const validation = isSet ? rt95FieldValueProblem(field, text) : undefined;
    const setEmpty = isSet && text === '';
    control = (
      <TextInput
        id={controlId}
        aria-label={field.label}
        value={text}
        placeholder={setEmpty ? SET_EMPTY_LINE_LABEL : KEEP_RADIO_VALUE_LABEL}
        error={Boolean(validation)}
        hint={validation ?? (setEmpty ? SET_EMPTY_LINE_HINT : undefined)}
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
        : (field.options ?? []).map((o) => ({
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
        {note ? <div className={classes.note}>{note}</div> : null}
        {problemProp ? (
          <div className={classes.problem} role="alert">
            {problemProp}
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

const Rt95RadioSettingRow = memo(Rt95RadioSettingRowView, (a, b) => {
  const sameField =
    a.field === b.field ||
    (a.field.id === b.field.id && JSON.stringify(a.field) === JSON.stringify(b.field));
  return (
    sameField &&
    a.override === b.override &&
    a.decoded === b.decoded &&
    a.hasRead === b.hasRead &&
    a.note === b.note &&
    a.problem === b.problem
  );
});

export default Rt95RadioSettingRow;
