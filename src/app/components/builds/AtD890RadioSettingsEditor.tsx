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
import {
  clearOverride,
  setOverride,
  useAtD890RadioSettingsSession,
} from '../../state/atD890RadioSettingsSession.ts';
import { Panel, StatusBanner } from '../v2/index.ts';
import AtD890RadioSettingRow from './AtD890RadioSettingRow.tsx';
import classes from './AtD890RadioSettingsEditor.module.css';

export interface AtD890RadioSettingsEditorProps {
  buildId: string;
  target: AtD890SettingsTargetId;
}

const LARGE_FONT_HINT = 'Both lines 8 characters or fewer use the large font.';

export function changesLabel(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

function fieldsOfSection(sectionId: string): AtD890SettingFieldDef[] {
  return AT_D890_SETTING_FIELDS.filter((f) => f.section === sectionId);
}

export default function AtD890RadioSettingsEditor({
  buildId,
  target,
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
      </div>
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
