/**
 * AT-D890UV radio settings editor (#1393): the sections of v1 fields, each with a Keep / Set
 * control, over the per-build session store. Renders from core field metadata.
 */

import {
  AT_D890_SETTING_FIELDS,
  AT_D890_SETTING_SECTIONS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
  type AtD890SettingFieldDef,
  type AtD890SettingsTargetId,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { Fragment, useState } from 'react';
import { mm9pdyStepKeyOverrides } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { Link } from 'react-router-dom';
import {
  clearAllOverrides,
  copyAllFromRead,
  clearOverride,
  setOverride,
  useAtD890RadioSettingsSession,
} from '../../state/atD890RadioSettingsSession.ts';
import type { AtD890RadioSettingsRead } from '../../state/atD890RadioSettingsSession.ts';
import { Button, ConfirmModal, Panel, StatusBanner } from '../v2/index.ts';
import Mm9pdyStepKeysNudge from './Mm9pdyStepKeysNudge.tsx';
import AtD890RadioSettingRow from './AtD890RadioSettingRow.tsx';
import AtD890RadioSettingsReadButton from './AtD890RadioSettingsReadButton.tsx';
import classes from './AtD890RadioSettingsEditor.module.css';

export interface AtD890RadioSettingsEditorProps {
  buildId: string;
  target: AtD890SettingsTargetId;
  /** The build's Web Serial egress, used by Read a radio. */
  egress: EgressPath;
}

export const WRITE_ARRIVES_LATER_NOTE =
  'Writing these settings arrives with the next Write update.';

const LARGE_FONT_HINT = 'Both lines 8 characters or fewer use the large font.';

export function changesLabel(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

/** hh:mm in the user's locale. */
function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function lastFour(serial: string): string {
  return serial.length <= 4 ? serial : serial.slice(-4);
}

/** Banner text for a settings read. Never shows more than the last four serial characters. */
export function readBannerText(read: AtD890RadioSettingsRead): string {
  const name = read.masterIdName.trim() || 'the radio';
  return `Read from ${name} (…${lastFour(read.serial)}) at ${timeLabel(read.readAt)} · range ${rangeCaption(read.bandCode)}`;
}

/**
 * The frequency range caption for the band code from the read.
 * TODO(#1393 PR 7): use describeAtD890FrequencyRange(code) once PR 7 (#1395) is on this stack;
 * whichever of PR 3 / PR 7 merges second completes this line.
 */
function rangeCaption(bandCode: number): string {
  return `code ${bandCode}`;
}

function numberOrUndefined(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

function fieldsOfSection(sectionId: string): AtD890SettingFieldDef[] {
  return AT_D890_SETTING_FIELDS.filter((f) => f.section === sectionId);
}

export default function AtD890RadioSettingsEditor({
  buildId,
  target,
  egress,
}: AtD890RadioSettingsEditorProps) {
  const session = useAtD890RadioSettingsSession(buildId);
  const { overrides, read } = session;

  const [confirm, setConfirm] = useState<'clear' | 'copy' | null>(null);
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
          {changesLabel(overrides.size)}
        </span>
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
              <dd>{rangeCaption(read.bandCode)}</dd>
            </div>
            <div>
              <dt>Firmware</dt>
              <dd>unknown</dd>
            </div>
            <div>
              <dt>Serial</dt>
              <dd>…{lastFour(read.serial)}</dd>
            </div>
          </dl>
          <details className={classes.why}>
            <summary>Why can&apos;t I change these?</summary>
            <p>
              The frequency range is the radio&apos;s region, set at the factory; Studio can only
              show it. Changing it is tracked in issue #1369. Studio cannot yet tell stock firmware
              from MM9PDY, so the firmware shows as unknown (issue #613). Only the last four
              characters of the serial are shown.
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
      </div>
      {overrides.size > 0 ? (
        <div className={classes.footer} data-testid="changes-footer">
          <span className={classes.footerCount}>{changesLabel(overrides.size)}</span>
          <Button variant="outline" size="sm" onClick={() => setConfirm('clear')}>
            Clear all
          </Button>
          <span className={classes.footerNote}>{WRITE_ARRIVES_LATER_NOTE}</span>
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
