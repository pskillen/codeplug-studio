/**
 * Step 1: what to write (#1393). One tick per part; options only under ticked parts; rows a radio
 * does not support are not shown. Primary button: Read & write, the user's consent to write (#1638).
 */

import { Link } from 'react-router-dom';
import { Alert, Anchor, Switch, Text } from '@mantine/core';
import { hasProblemWarnings } from '@core/import-export/exportWarning.ts';
import { WarningsList } from '../../../egress/index.ts';
import type { DigitalContactsWriteSource } from '@core/domain/digitalIdDirectoryProjection.ts';
import KepsLastUpdated from '../../../library/KepsLastUpdated.tsx';
import { Button, FormField, SegmentedControl } from '../../../v2/index.ts';
import WritePartRow from '../WritePartRow.tsx';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';
import { changesLabel } from '../../../../lib/atD890RadioSettingsText.ts';
import { contactSourceHint } from '../contactSourceHint.ts';
import { tickedPartCount } from '../writeParts.ts';

const CONTACT_SOURCE_OPTIONS: {
  value: Exclude<DigitalContactsWriteSource, 'none'>;
  label: string;
}[] = [
  { value: 'library', label: 'Contacts' },
  { value: 'directory', label: 'ID directory' },
  { value: 'both', label: 'Both' },
];

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function WhatToWriteBody({ config, view, actions }: StepProps) {
  const { parts } = view;
  const { parts: support } = config.options;
  const set = (patch: Partial<typeof parts>) => actions.onPartsChange({ ...parts, ...patch });

  return (
    <div className={classes.stack}>
      <div>
        <WritePartRow
          title="Codeplug"
          summary={
            config.codeplugSummary ??
            'Channels, zones, scan lists and the other modelled lists from this build'
          }
          checked={parts.codeplug}
          onCheckedChange={(codeplug) => set({ codeplug })}
        >
          {config.channelLocationNote ? (
            <Text size="xs" c="dimmed" data-testid="write-radio-channel-location-note">
              {config.channelLocationNote}
            </Text>
          ) : null}
          {config.stepKeys ? (
            <Switch
              label="Assign TG previous and TG next"
              description={`${config.stepKeys.description} Saved with this build.`.trim()}
              checked={config.stepKeys.checked}
              onChange={(event) => config.stepKeys?.onChange(event.currentTarget.checked)}
            />
          ) : null}
        </WritePartRow>

        {support.settings && config.radioSettings ? (
          <WritePartRow
            title="Radio settings"
            summary={
              <span data-testid="write-radio-settings-summary">
                {config.radioSettings.count > 0
                  ? changesLabel(config.radioSettings.count)
                  : 'No changes set'}{' '}
                ·{' '}
                <Anchor component="button" type="button" size="xs" onClick={actions.onEditSettings}>
                  {config.radioSettings.count > 0 ? 'Edit' : 'Set up…'}
                </Anchor>
              </span>
            }
            checked={parts.settings && config.radioSettings.count > 0}
            disabled={config.radioSettings.count === 0}
            onCheckedChange={(settings) => set({ settings })}
          >
            <Text size="xs" c="dimmed" data-testid="write-radio-settings-words">
              {config.radioSettings.words.join(' · ')}
            </Text>
          </WritePartRow>
        ) : null}

        {support.contacts ? (
          <WritePartRow
            title="Digital contacts"
            summary="Replaces the radio's contact list"
            checked={parts.contacts}
            onCheckedChange={(contacts) => set({ contacts })}
          >
            {view.contactDirectoryStatus === 'checking' ? (
              <Text size="sm" role="status">
                Checking ID directory…
              </Text>
            ) : view.contactDirectoryStatus === 'empty' ? (
              <Alert color="yellow" title="ID directory is empty">
                Fetch or import IDs before writing the ID directory, or select Contacts or untick
                Digital contacts.
              </Alert>
            ) : view.contactDirectoryStatus === 'error' ? (
              <Alert color="red" title="Could not check the ID directory">
                Select Contacts or untick Digital contacts to continue. To retry the directory
                check, select Contacts, then ID directory or Both again.
              </Alert>
            ) : null}
            <FormField
              label="Contact source"
              hint={contactSourceHint(config.options.contactStore, config.options.radioLabel)}
            >
              <SegmentedControl
                size="sm"
                value={view.contactSource}
                onChange={actions.onContactSourceChange}
                aria-label="Contact source"
                options={CONTACT_SOURCE_OPTIONS}
              />
            </FormField>
          </WritePartRow>
        ) : null}

        {support.keps ? (
          <WritePartRow
            title="Satellite keps"
            summary={
              <>
                {config.kepsSummary ? <span>{config.kepsSummary} · </span> : null}
                <Anchor component={Link} to={`/builds/${config.buildId}/satellite-keps`} size="xs">
                  Preview on the Satellite keps tab
                </Anchor>
              </>
            }
            checked={parts.keps}
            onCheckedChange={(keps) => set({ keps })}
          >
            <Text size="xs" c="dimmed" component="div">
              Writes enabled library satellites only.{' '}
              <KepsLastUpdated
                iso={config.kepsLastUpdatedIso}
                libraryHref="/library/satellite-keps"
              />
            </Text>
          </WritePartRow>
        ) : null}
      </div>

      {view.buildChecks.status !== 'idle' ? (
        <section aria-label="Build checks" data-testid="write-build-checks">
          <Text size="sm" fw={600}>
            Build checks
          </Text>
          <Text size="xs" c="dimmed">
            Worked out from the build, no radio needed.
          </Text>
          {view.buildChecks.status === 'checking' ? (
            <Text size="sm" role="status">
              Checking the build…
              {view.buildChecks.progress ? ` ${view.buildChecks.progress}` : ''}
            </Text>
          ) : null}
          {view.buildChecks.status === 'ready' && view.buildChecks.refusals.length > 0 ? (
            <Alert
              color="red"
              title="Studio can't write this build to the radio yet"
              data-testid="write-projection-refusals"
            >
              <ul className={classes.refusalList}>
                {view.buildChecks.refusals.map((refusal) => (
                  <li key={`${refusal.channelIndex ?? 'x'}-${refusal.message}`}>
                    {/* Write projection carries slot index and wire name only — no library id. */}
                    {refusal.message}
                  </li>
                ))}
              </ul>
              <Text size="sm">
                Fix these channels in the build, then try again. Nothing has been sent.
              </Text>
            </Alert>
          ) : null}
          {view.buildChecks.status === 'ready' ? (
            <>
              <WarningsList
                warnings={view.buildChecks.warnings}
                mode="full"
                channelLabel={view.channelLabel}
              />
              {hasProblemWarnings(view.buildChecks.warnings) ? (
                <Text size="sm" c="dimmed">
                  Studio will stop on Review before writing, so you can cancel then.
                </Text>
              ) : null}
            </>
          ) : null}
          {view.buildChecks.status === 'error' && view.buildChecks.message ? (
            <Text size="sm" c="red">
              {view.buildChecks.message}
            </Text>
          ) : null}
        </section>
      ) : null}

      <Text size="sm" c="dimmed">
        Anything not ticked stays as it is on the radio.
      </Text>
      <Text size="sm" c="dimmed" data-testid="write-radio-one-go-note">
        Read &amp; write reads the radio, then writes it. Studio stops to ask you first only when
        something needs your attention.
      </Text>
    </div>
  );
}

export function WhatToWriteFooter({ config, view, actions }: StepProps) {
  const disabled =
    !config.serialOk ||
    config.writeHidden ||
    tickedPartCount(view.parts) === 0 ||
    view.busy ||
    view.buildChecks.refusals.length > 0 ||
    (view.contactDirectoryStatus != null && view.contactDirectoryStatus !== 'ready');
  return (
    <>
      <Button variant="secondary" size="sm" onClick={actions.onClose}>
        Cancel
      </Button>
      <Button variant="primary" size="sm" disabled={disabled} onClick={actions.onConnectAndRead}>
        Read &amp; write
      </Button>
    </>
  );
}
