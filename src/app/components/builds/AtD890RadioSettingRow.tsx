/**
 * One AT-D890UV radio setting: label, where it lives on the radio, help, the value the radio holds,
 * and a Keep / Set control (#1393). Renders from core field metadata only.
 */

import { NativeSelect } from '@mantine/core';
import {
  atD890SettingExposureFor,
  atD890SettingOptionsFor,
  atD890SettingValueLabelFor,
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
import classes from './AtD890RadioSettingRow.module.css';

export const KEEP_RADIO_VALUE_LABEL = "Keep radio's value";

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
}

/** The Radio column text. Exported for tests and the review step. */
export function radioValueText(
  field: AtD890SettingFieldDef,
  target: AtD890SettingsTargetId,
  decoded: AtD890DecodedSetting | undefined,
  hasRead: boolean,
): string {
  if (!hasRead) return 'not read';
  if (!decoded) return 'not on this radio';
  const { value } = decoded;
  if (value === undefined) {
    if (decoded.label) return `${decoded.label} (not offered)`;
    const shown = field.kind === 'text' ? 'unreadable text' : decoded.raw.join(' ');
    return `${shown} (not offered)`;
  }
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'string') return value === '' ? '(empty)' : value;
  return atD890SettingValueLabelFor(field, value, target) ?? String(value);
}

export default function AtD890RadioSettingRow({
  field,
  target,
  override,
  decoded,
  hasRead,
  onSet,
  onClear,
  note,
}: AtD890RadioSettingRowProps) {
  const isSet = override !== undefined;
  const exposure = atD890SettingExposureFor(field, target);
  const radioText = radioValueText(field, target, decoded, hasRead);
  const controlId = `d890-setting-${field.id}`;

  let control;
  if (field.kind === 'text') {
    const text = typeof override === 'string' ? override : '';
    const problem = isSet ? atD890TextProblem(field, text) : undefined;
    control = (
      <TextInput
        id={controlId}
        aria-label={field.label}
        value={text}
        placeholder={KEEP_RADIO_VALUE_LABEL}
        error={Boolean(problem)}
        hint={problem}
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
        {note ? <div className={classes.note}>{note}</div> : null}
      </div>
    </div>
  );
}
