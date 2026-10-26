/**
 * AT-D890UV radio settings editor (#1393): the sections of v1 fields, each with a Keep / Set
 * control, over the per-build session store. Renders from core field metadata.
 */

import {
  AT_D890_POWER_ON_PASSWORD_FIELD_IDS,
  AT_D890_SETTING_FIELDS,
  AT_D890_SETTING_SECTIONS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
  atD890LanguagesForLock,
  type AtD890SettingFieldDef,
  type AtD890SettingsTargetId,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { Fragment, useState } from 'react';
import { mm9pdyStepKeyOverrides } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { Link, useNavigate } from 'react-router-dom';
import {
  advancedOverrideCount,
  atD890OverrideCount,
  clearAllOverrides,
  clearPowerOnPassword,
  copyAllFromRead,
  clearOverride,
  setOverride,
  setPowerOnPassword,
  setPowerOnPasswordOff,
  setShowAdvanced,
  setWriteSettingsRequested,
  useAtD890RadioSettingsSession,
} from '../../state/atD890RadioSettingsSession.ts';
import { Button, ConfirmModal, Panel, StatusBanner, ToggleSwitch } from '../v2/index.ts';
import Mm9pdyStepKeysNudge from './Mm9pdyStepKeysNudge.tsx';
import AtD890RadioSettingRow from './AtD890RadioSettingRow.tsx';
import AtD890PowerOnPasswordRow from './AtD890PowerOnPasswordRow.tsx';
import AtD890RadioSettingsReadButton from './AtD890RadioSettingsReadButton.tsx';
import {
  changesLabel,
  readBannerText,
  rangeSummary,
  repeaterModeAdvice,
} from '../../lib/atD890RadioSettingsText.ts';
import classes from './AtD890RadioSettingsEditor.module.css';

export interface AtD890RadioSettingsEditorProps {
  buildId: string;
  target: AtD890SettingsTargetId;
  /** The build's Web Serial egress, used by Read a radio. */
  egress: EgressPath;
  /** True when the Radio tools area is offered for this build on this deploy (gate open). */
  radioToolsOffered?: boolean;
}

const LARGE_FONT_HINT = 'Both lines 8 characters or fewer use the large font.';

function numberOrUndefined(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

function fieldsOfSection(sectionId: string): AtD890SettingFieldDef[] {
  return AT_D890_SETTING_FIELDS.filter((f) => f.section === sectionId && !f.advanced);
}

const ADVANCED_FIELDS = AT_D890_SETTING_FIELDS.filter((f) => f.advanced);

const LANGUAGE_BEFORE_READ = 'Read the radio first: its region decides which languages stick.';

export default function AtD890RadioSettingsEditor({
  buildId,
  target,
  egress,
  radioToolsOffered = false,
}: AtD890RadioSettingsEditorProps) {
  const session = useAtD890RadioSettingsSession(buildId);
  const navigate = useNavigate();
  const { overrides, read } = session;

  const [confirm, setConfirm] = useState<'clear' | 'copy' | 'advancedOff' | null>(null);
  const { showAdvanced } = session;
  const changeCount = atD890OverrideCount(overrides);
  const copyCount = read
    ? AT_D890_V1_SETTINGS_FIELD_IDS.filter((id) => read.decoded[id]?.value !== undefined).length
    : 0;

  const effective = (id: string) => overrides.get(id) ?? read?.decoded[id]?.value;
  const customTextWithEmptyLine1 =
    effective('powerOnScreen') === 1 && effective('powerOnLine1') === '';

  return (
    <div className={classes.editor}>
      <div className={classes.toolbar}>
        <span className={classes.count} aria-live="polite" data-testid="changes-count">
          {changesLabel(changeCount)}
        </span>
        <ToggleSwitch
          checked={showAdvanced}
          label="Show advanced settings"
          onChange={(on) => {
            if (on) setShowAdvanced(buildId, true);
            else if (advancedOverrideCount(overrides) > 0) setConfirm('advancedOff');
            else setShowAdvanced(buildId, false);
          }}
        />
        <AtD890RadioSettingsReadButton buildId={buildId} egress={egress} />
        {read ? (
          <Button
            variant="outline"
            size="sm"
            disabled={copyCount === 0}
            onClick={() => setConfirm('copy')}
          >
            Copy all from this radio
          </Button>
        ) : null}
      </div>
      {read ? (
        <div className={classes.banner} data-testid="read-banner">
          <StatusBanner tone="info">{readBannerText(read)}</StatusBanner>
          <dl className={classes.readOnly}>
            <div>
              <dt>Frequency range</dt>
              <dd>
                {rangeSummary(read.bandCode)}
                {radioToolsOffered ? (
                  <>
                    {' · '}
                    <Link to={`/builds/${buildId}/export/radio-tools`}>Change…</Link>
                  </>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Firmware</dt>
              <dd>unknown</dd>
            </div>
            <div>
              <dt>Serial</dt>
              <dd>{read.serial}</dd>
            </div>
          </dl>
          <details className={classes.why}>
            <summary>Why can&apos;t I change these?</summary>
            <p>
              The frequency range is the radio&apos;s region, set at the factory.{' '}
              {radioToolsOffered
                ? 'You can change it from Radio tools.'
                : 'Studio can only show it.'}{' '}
              Studio cannot yet tell stock firmware from MM9PDY, so the firmware shows as unknown
              (issue #613).
            </p>
          </details>
        </div>
      ) : null}
      <div className={classes.sections}>
        {AT_D890_SETTING_SECTIONS.map((section) => {
          const fields = fieldsOfSection(section.id);
          if (fields.length === 0) return null;
          const setCount = fields.filter((f) => overrides.has(f.id)).length;
          return (
            <Fragment key={section.id}>
              {section.id === 'keys' ? (
                <Mm9pdyStepKeysNudge
                  target={target}
                  hasRead={read !== undefined}
                  readP1={numberOrUndefined(read?.decoded.keyShortP1?.value)}
                  readP2={numberOrUndefined(read?.decoded.keyShortP2?.value)}
                  overrideP1={overrides.get('keyShortP1')}
                  overrideP2={overrides.get('keyShortP2')}
                  onUse={() => {
                    for (const o of mm9pdyStepKeyOverrides()) {
                      setOverride(buildId, o.fieldId, o.value);
                    }
                  }}
                />
              ) : null}
              <Panel
                id={`radio-settings-${section.id}`}
                title={section.label}
                collapsible
                badge={setCount > 0 ? changesLabel(setCount) : undefined}
              >
                {section.id === 'startup' && customTextWithEmptyLine1 ? (
                  <StatusBanner tone="warning">
                    The power-on screen is Custom text but line 1 is empty, so the radio shows an
                    empty start-up screen.
                  </StatusBanner>
                ) : null}
                <div className={classes.rows}>
                  {fields.map((field) => (
                    <AtD890RadioSettingRow
                      key={field.id}
                      field={field}
                      target={target}
                      override={overrides.get(field.id)}
                      decoded={read?.decoded[field.id]}
                      hasRead={read !== undefined}
                      note={field.id.startsWith('powerOnLine') ? LARGE_FONT_HINT : undefined}
                      onSet={(value) => setOverride(buildId, field.id, value)}
                      onClear={() => clearOverride(buildId, field.id)}
                    />
                  ))}
                </div>
              </Panel>
            </Fragment>
          );
        })}
        {showAdvanced ? (
          <Panel
            id="radio-settings-advanced"
            title="Advanced"
            collapsible
            badge={
              advancedOverrideCount(overrides) > 0
                ? changesLabel(advancedOverrideCount(overrides))
                : undefined
            }
          >
            <StatusBanner tone="warning">
              A wrong value here can lock the radio or stop most of it working. Each setting says
              what it does once you set it.
            </StatusBanner>
            <div className={classes.rows} data-testid="advanced-rows">
              {ADVANCED_FIELDS.map((field) => {
                if (field.id === AT_D890_POWER_ON_PASSWORD_FIELD_IDS[1]) return null;
                if (field.id === AT_D890_POWER_ON_PASSWORD_FIELD_IDS[0]) {
                  const enabled = overrides.get('powerOnPasswordEnabled');
                  const digitsOverride = overrides.get('powerOnPasswordDigits');
                  return (
                    <AtD890PowerOnPasswordRow
                      key="powerOnPassword"
                      enabledOverride={typeof enabled === 'boolean' ? enabled : undefined}
                      digitsOverride={
                        typeof digitsOverride === 'string' ? digitsOverride : undefined
                      }
                      decodedEnabled={read?.decoded.powerOnPasswordEnabled}
                      hasRead={read !== undefined}
                      onSetPassword={(digits) => setPowerOnPassword(buildId, digits)}
                      onClearPassword={() => setPowerOnPasswordOff(buildId)}
                      onKeep={() => clearPowerOnPassword(buildId)}
                    />
                  );
                }
                if (field.id === 'language') {
                  const current = overrides.get('language');
                  const allowed = atD890LanguagesForLock(read?.languageLock ?? 0);
                  const stranded =
                    read !== undefined &&
                    typeof current === 'number' &&
                    !allowed.some((o) => o.value === current);
                  const options = stranded
                    ? [
                        ...allowed,
                        ...(field.options ?? [])
                          .filter((o) => o.value === current)
                          .map((o) => ({ ...o, label: `${o.label} (not allowed here)` })),
                      ]
                    : allowed;
                  return (
                    <AtD890RadioSettingRow
                      key={field.id}
                      field={{ ...field, options }}
                      target={target}
                      override={current}
                      decoded={read?.decoded[field.id]}
                      hasRead={read !== undefined}
                      disabledReason={read === undefined ? LANGUAGE_BEFORE_READ : undefined}
                      problem={
                        stranded
                          ? "This radio's region doesn't allow that language; a Write would be refused."
                          : undefined
                      }
                      note={
                        read !== undefined && read.languageLock !== 0
                          ? `This radio's region only allows ${read.languageLock === 1 ? 'English' : 'Chinese'}.`
                          : undefined
                      }
                      onSet={(value) => setOverride(buildId, field.id, value)}
                      onClear={() => clearOverride(buildId, field.id)}
                    />
                  );
                }
                const advice =
                  field.id === 'repeaterMode'
                    ? repeaterModeAdvice(effective('repeaterMode') === true, read?.repeaterBoot)
                    : undefined;
                return (
                  <AtD890RadioSettingRow
                    key={field.id}
                    field={field}
                    target={target}
                    override={overrides.get(field.id)}
                    decoded={read?.decoded[field.id]}
                    hasRead={read !== undefined}
                    caution={advice?.caution}
                    note={advice?.note}
                    onSet={(value) => setOverride(buildId, field.id, value)}
                    onClear={() => clearOverride(buildId, field.id)}
                  />
                );
              })}
            </div>
          </Panel>
        ) : null}
      </div>
      {overrides.size > 0 ? (
        <div className={classes.footer} data-testid="changes-footer">
          <span className={classes.footerCount}>{changesLabel(changeCount)}</span>
          <Button variant="outline" size="sm" onClick={() => setConfirm('clear')}>
            Clear all
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setWriteSettingsRequested(buildId, true);
              navigate(`/builds/${buildId}/export`);
            }}
          >
            Write settings…
          </Button>
          <span className={classes.footerNote}>Writes only these settings, nothing else.</span>
          <Link className={classes.footerLink} to={`/builds/${buildId}/backup`}>
            Back up a radio
          </Link>
        </div>
      ) : null}
      <ConfirmModal
        open={confirm === 'clear'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          clearAllOverrides(buildId);
          setConfirm(null);
        }}
        title="Clear all changes?"
        confirmLabel="Clear all"
        tone="destructive"
      >
        Every field goes back to Keep radio&apos;s value.
      </ConfirmModal>
      <ConfirmModal
        open={confirm === 'advancedOff'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setShowAdvanced(buildId, false);
          setConfirm(null);
        }}
        title="Hide advanced settings?"
        confirmLabel="Hide and discard"
        tone="destructive"
      >
        This discards {advancedOverrideCount(overrides)} advanced{' '}
        {advancedOverrideCount(overrides) === 1 ? 'change' : 'changes'}. Settings you cannot see are
        never written.
      </ConfirmModal>
      <ConfirmModal
        open={confirm === 'copy'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          copyAllFromRead(buildId);
          setConfirm(null);
        }}
        title="Copy all from this radio?"
        confirmLabel="Copy all"
      >
        Set {copyCount} fields to this radio&apos;s values?
      </ConfirmModal>
    </div>
  );
}
