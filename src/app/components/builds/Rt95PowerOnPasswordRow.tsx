/**
 * RT95 power-on password: one control over enable + six digits (#1476).
 */

import { useState } from 'react';
import {
  RT95_POWER_ON_PASSWORD_DIGITS,
  rt95SettingField,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import type { Rt95DecodedSetting } from '@integrations/radio-io/radios/rt95/settingsCodec.ts';
import { Button, TextInput } from '../v2/index.ts';
import {
  KEEP_RADIO_VALUE_LABEL,
  rt95PowerOnPasswordProblem,
} from '../../lib/rt95RadioSettingsText.ts';
import classes from './AtD890RadioSettingRow.module.css';

export interface Rt95PowerOnPasswordRowProps {
  enabledOverride: boolean | undefined;
  digitsOverride: string | undefined;
  decodedEnabled: Rt95DecodedSetting | undefined;
  hasRead: boolean;
  onSetPassword: (digits: string) => void;
  onClearPassword: () => void;
  onKeep: () => void;
}

export default function Rt95PowerOnPasswordRow({
  enabledOverride,
  digitsOverride,
  decodedEnabled,
  hasRead,
  onSetPassword,
  onClearPassword,
  onKeep,
}: Rt95PowerOnPasswordRowProps) {
  const field = rt95SettingField('powerOnPasswordEnabled')!;
  const [draftDigits, setDigits] = useState(enabledOverride === true ? (digitsOverride ?? '') : '');
  const [draftAgain, setAgain] = useState(enabledOverride === true ? (digitsOverride ?? '') : '');
  const isSet = enabledOverride !== undefined;
  const stale =
    enabledOverride !== true &&
    draftDigits !== '' &&
    !rt95PowerOnPasswordProblem(draftDigits, draftAgain);
  const digits = stale ? '' : draftDigits;
  const again = stale ? '' : draftAgain;
  const problem = rt95PowerOnPasswordProblem(digits, again);

  function edit(nextDigits: string, nextAgain: string) {
    setDigits(nextDigits);
    setAgain(nextAgain);
    if (nextDigits !== '' && !rt95PowerOnPasswordProblem(nextDigits, nextAgain)) {
      onSetPassword(nextDigits);
    } else if (isSet) {
      onKeep();
    }
  }

  const radioText = !hasRead
    ? 'not read'
    : decodedEnabled?.value === undefined
      ? 'unknown'
      : decodedEnabled.value === true
        ? 'On'
        : 'Off';

  return (
    <div
      className={classes.row}
      data-field-id="powerOnPassword"
      data-set={isSet ? 'true' : 'false'}
    >
      <div className={classes.info}>
        <div className={classes.labelLine}>
          <span className={classes.label}>{field.label}</span>
        </div>
        <div className={classes.help}>
          {field.help} {RT95_POWER_ON_PASSWORD_DIGITS} digits, typed twice.
        </div>
      </div>
      <div className={classes.radio}>
        <span className={classes.radioCaption}>Radio:</span> <span>{radioText}</span>
      </div>
      <div className={classes.controlCell}>
        <div className={classes.control}>
          <TextInput
            aria-label="Password digits"
            value={digits}
            placeholder={KEEP_RADIO_VALUE_LABEL}
            error={Boolean(problem)}
            hint={problem}
            onChange={(e) => edit(e.target.value, again)}
          />
          <TextInput
            aria-label="Password digits again"
            value={again}
            placeholder="Type again"
            error={Boolean(problem)}
            onChange={(e) => edit(digits, e.target.value)}
          />
        </div>
        <div className={classes.marker}>
          {isSet ? (
            <>
              <span className={classes.dot} role="img" aria-label="Will be set" />
              <Button variant="ghost" size="sm" aria-label="Clear password" onClick={onKeep}>
                Clear
              </Button>
            </>
          ) : null}
        </div>
        {field.warning ? (
          <div className={classes.warning} data-testid="field-warning">
            {field.warning}
          </div>
        ) : null}
        <Button variant="outline" size="sm" onClick={onClearPassword}>
          Clear password on radio
        </Button>
      </div>
    </div>
  );
}
