/**
 * The AT-D890UV power-on password: one control over two radio fields (#1393). Digits only, typed
 * twice, shown in clear. **Clear password** turns the prompt off and is always available, read or
 * not. The password is session state like every override, and the radio's own digits are never shown.
 */

import { useState } from 'react';
import {
  AT_D890_POWER_ON_PASSWORD_MAX_DIGITS,
  atD890SettingField,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type { AtD890DecodedSetting } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { Button, TextInput } from '../v2/index.ts';
import {
  KEEP_RADIO_VALUE_LABEL,
  powerOnPasswordProblem,
} from '../../lib/atD890RadioSettingsText.ts';
import classes from './AtD890RadioSettingRow.module.css';

export interface AtD890PowerOnPasswordRowProps {
  /** The `+0x07` override: `true` password on, `false` cleared, `undefined` keep. */
  enabledOverride: boolean | undefined;
  /** The digits override (empty when cleared). */
  digitsOverride: string | undefined;
  /** What the last Read found for the on/off byte. */
  decodedEnabled: AtD890DecodedSetting | undefined;
  hasRead: boolean;
  onSetPassword: (digits: string) => void;
  /** Turn the prompt off and wipe the digits. */
  onClearPassword: () => void;
  /** Back to Keep. */
  onKeep: () => void;
}

export default function AtD890PowerOnPasswordRow({
  enabledOverride,
  digitsOverride,
  decodedEnabled,
  hasRead,
  onSetPassword,
  onClearPassword,
  onKeep,
}: AtD890PowerOnPasswordRowProps) {
  const field = atD890SettingField('powerOnPasswordEnabled')!;
  const [draftDigits, setDigits] = useState(enabledOverride === true ? (digitsOverride ?? '') : '');
  const [draftAgain, setAgain] = useState(enabledOverride === true ? (digitsOverride ?? '') : '');
  const isSet = enabledOverride !== undefined;
  const turningOn = enabledOverride === true;

  // Clear all, or Keep from elsewhere, leaves boxes holding a complete password the overrides no
  // longer carry: show them empty, so the page shows the effective state.
  const stale =
    enabledOverride !== true &&
    draftDigits !== '' &&
    !powerOnPasswordProblem(draftDigits, draftAgain);
  const digits = stale ? '' : draftDigits;
  const again = stale ? '' : draftAgain;

  const problem = powerOnPasswordProblem(digits, again);

  // The latest edit wins: a complete, matching pair becomes the override; anything else is Keep.
  function edit(nextDigits: string, nextAgain: string) {
    setDigits(nextDigits);
    setAgain(nextAgain);
    if (nextDigits !== '' && !powerOnPasswordProblem(nextDigits, nextAgain)) {
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
          <span className={classes.tag}>On radio menu</span>
        </div>
        <div className={classes.help}>
          {field.help} 1 to {AT_D890_POWER_ON_PASSWORD_MAX_DIGITS} digits, typed twice.
        </div>
      </div>
      <div className={classes.radio}>
        <span className={classes.radioCaption}>Radio:</span> <span>{radioText}</span>
      </div>
      <div className={classes.controlCell}>
        <div className={classes.control}>
          <TextInput
            aria-label="New power-on password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={AT_D890_POWER_ON_PASSWORD_MAX_DIGITS + 4}
            value={digits}
            placeholder={KEEP_RADIO_VALUE_LABEL}
            error={Boolean(problem) && digits !== ''}
            onChange={(e) => edit(e.target.value, again)}
          />
          <TextInput
            aria-label="Type the power-on password again"
            inputMode="numeric"
            autoComplete="off"
            maxLength={AT_D890_POWER_ON_PASSWORD_MAX_DIGITS + 4}
            value={again}
            placeholder="Type it again"
            error={Boolean(problem) && digits !== ''}
            hint={digits !== '' || again !== '' ? problem : undefined}
            onChange={(e) => edit(digits, e.target.value)}
          />
        </div>
        <div className={classes.marker}>
          {isSet ? <span className={classes.dot} role="img" aria-label="Will be set" /> : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDigits('');
              setAgain('');
              onClearPassword();
            }}
          >
            Clear password
          </Button>
          {isSet ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Clear Power-on password change"
              onClick={onKeep}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {enabledOverride === false ? (
          <div className={classes.note} data-testid="password-will-clear">
            Will turn the power-on password off.
          </div>
        ) : null}
        {turningOn && field.warning ? (
          <div className={classes.warning} data-testid="field-warning">
            {field.warning}
          </div>
        ) : null}
      </div>
    </div>
  );
}
