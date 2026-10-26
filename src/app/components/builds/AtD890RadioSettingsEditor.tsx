/**
 * AT-D890UV radio settings editor (#1393): the sections of v1 fields, each with a Keep / Set
 * control, over the per-build session store. Renders from core field metadata.
 */

import {
  AT_D890_SETTING_FIELDS,
  AT_D890_SETTING_SECTIONS,
  type AtD890SettingFieldDef,
  type AtD890SettingsTargetId,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  clearOverride,
  setOverride,
  useAtD890RadioSettingsSession,
} from '../../state/atD890RadioSettingsSession.ts';
import type { AtD890RadioSettingsRead } from '../../state/atD890RadioSettingsSession.ts';
import { Panel, StatusBanner } from '../v2/index.ts';
import AtD890RadioSettingRow from './AtD890RadioSettingRow.tsx';
import AtD890RadioSettingsReadButton from './AtD890RadioSettingsReadButton.tsx';
import classes from './AtD890RadioSettingsEditor.module.css';

export interface AtD890RadioSettingsEditorProps {
  buildId: string;
  target: AtD890SettingsTargetId;
  /** The build's Web Serial egress, used by Read a radio. */
  egress: EgressPath;
}

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
            <Panel
              key={section.id}
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
          );
        })}
      </div>
    </div>
  );
}
