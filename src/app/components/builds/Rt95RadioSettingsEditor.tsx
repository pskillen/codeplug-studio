/**
 * RT95 radio settings editor (#1476): sections of fields with Keep / Set over the session store.
 */

import {
  RT95_BASIC_SETTINGS_FIELD_IDS,
  RT95_POWER_ON_PASSWORD_FIELD_IDS,
  RT95_SETTING_FIELDS,
  RT95_SETTING_SECTIONS,
  type Rt95SettingFieldDef,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  advancedOverrideCount,
  clearAllOverrides,
  clearOverride,
  clearPowerOnPassword,
  copyAllFromRead,
  rt95OverrideCount,
  setOverride,
  setPowerOnPassword,
  setPowerOnPasswordOff,
  setShowAdvanced,
  setWriteSettingsRequested,
  useRt95RadioSettingsSession,
} from '../../state/rt95RadioSettingsSession.ts';
import { Button, ConfirmModal, Panel, StatusBanner, ToggleSwitch } from '../v2/index.ts';
import Rt95PowerOnPasswordRow from './Rt95PowerOnPasswordRow.tsx';
import Rt95RadioSettingRow from './Rt95RadioSettingRow.tsx';
import Rt95RadioSettingsReadButton from './Rt95RadioSettingsReadButton.tsx';
import { changesLabel, readBannerText } from '../../lib/rt95RadioSettingsText.ts';
import classes from './AtD890RadioSettingsEditor.module.css';

export interface Rt95RadioSettingsEditorProps {
  buildId: string;
  egress: EgressPath;
}

const MAIN_SECTIONS = RT95_SETTING_SECTIONS.filter((s) => s.id !== 'advanced');

function fieldsOfSection(sectionId: string): Rt95SettingFieldDef[] {
  return RT95_SETTING_FIELDS.filter((f) => f.section === sectionId && !f.advanced);
}

const ADVANCED_FIELDS = RT95_SETTING_FIELDS.filter((f) => f.advanced);

export default function Rt95RadioSettingsEditor({ buildId, egress }: Rt95RadioSettingsEditorProps) {
  const session = useRt95RadioSettingsSession(buildId);
  const navigate = useNavigate();
  const { overrides, read, showAdvanced } = session;
  const [confirm, setConfirm] = useState<'clear' | 'copy' | 'advancedOff' | null>(null);

  const changeCount = rt95OverrideCount(overrides);
  const copyCount = read
    ? RT95_BASIC_SETTINGS_FIELD_IDS.filter((id) => read.decoded[id]?.value !== undefined).length
    : 0;

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
        <Rt95RadioSettingsReadButton buildId={buildId} egress={egress} />
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
        </div>
      ) : null}
      <div className={classes.sections}>
        {MAIN_SECTIONS.map((section) => {
          const fields = fieldsOfSection(section.id);
          if (fields.length === 0) return null;
          const setCount = fields.filter((f) => overrides.has(f.id)).length;
          return (
            <Panel
              key={section.id}
              id={`radio-settings-${section.id}`}
              title={section.label}
              collapsible
              badge={setCount > 0 ? changesLabel(setCount) : undefined}
            >
              <div className={classes.rows}>
                {fields.map((field) => (
                  <Rt95RadioSettingRow
                    key={field.id}
                    field={field}
                    override={overrides.get(field.id)}
                    decoded={read?.decoded[field.id]}
                    hasRead={read !== undefined}
                    onSet={(value) => setOverride(buildId, field.id, value)}
                    onClear={() => clearOverride(buildId, field.id)}
                  />
                ))}
              </div>
            </Panel>
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
                if (field.id === RT95_POWER_ON_PASSWORD_FIELD_IDS[1]) return null;
                if (field.id === RT95_POWER_ON_PASSWORD_FIELD_IDS[0]) {
                  const enabled = overrides.get('powerOnPasswordEnabled');
                  const digitsOverride = overrides.get('powerOnPasswordDigits');
                  return (
                    <Rt95PowerOnPasswordRow
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
                return (
                  <Rt95RadioSettingRow
                    key={field.id}
                    field={field}
                    override={overrides.get(field.id)}
                    decoded={read?.decoded[field.id]}
                    hasRead={read !== undefined}
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
